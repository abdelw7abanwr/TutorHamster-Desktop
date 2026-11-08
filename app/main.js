// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, ipcMain, session, Notification, shell, nativeImage } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('node:path')
const fs = require('node:fs')
const https = require('node:https')

// Set Windows AppUserModelId immediately at module load time so taskbar pinning & icon binding works
if (process.platform === 'win32') {
  app.setAppUserModelId('com.tutorhamster.desktop')
}

const localesModulePath = fs.existsSync(path.join(__dirname, '..', 'locales'))
  ? path.join(__dirname, '..', 'locales')
  : path.join(__dirname, 'locales')
const { getLocale } = require(localesModulePath)

// Load environment variables from root .env or app .env
const rootEnv = path.join(__dirname, '..', '.env')
const localEnv = path.join(__dirname, '.env')
const envPath = fs.existsSync(rootEnv) ? rootEnv : localEnv

if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath)
  } catch (err) {
    console.error('Failed to load .env file:', err)
  }
}

// Icon paths & NativeImage (guarantees correct Win32 taskbar rendering even inside asar)
const iconsDir = path.join(__dirname, '..', 'assets', 'icons')
const appIconIco = path.join(iconsDir, 'icon.ico')
const appIconPng = path.join(iconsDir, 'logo-v1-drop-rounded.png')
const appIconPath = (process.platform === 'win32' && fs.existsSync(appIconIco)) ? appIconIco : appIconPng
const appIcon = nativeImage.createFromPath(appIconPath)
const notificationIcon = path.join(iconsDir, 'notification-icon.png')

// Media permissions tracking
let mediaPermissionStatus = 'unknown'
let welcomeNotificationSent = false
let isOffline = false

// Helper to send localized system welcome notification once
function sendWelcomeNotification () {
  if (welcomeNotificationSent) return
  welcomeNotificationSent = true

  const systemLocale = app.getLocale() || 'en'
  const localeData = getLocale(systemLocale)

  if (Notification.isSupported()) {
    const notification = new Notification({
      title: localeData.welcomeTitle || 'Welcome to TutorHamster! 🎓',
      body: localeData.welcomeBody || 'Wishing you an inspiring and delightful learning journey today.',
      icon: notificationIcon,
      silent: false
    })

    // Do nothing on click (prevent any action or window focus)
    notification.on('click', (event) => {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault()
      }
    })

    notification.show()
  }
}

// Helper to send localized internet restored notification
function sendInternetRestoredNotification () {
  const systemLocale = app.getLocale() || 'en'
  const localeData = getLocale(systemLocale)

  if (Notification.isSupported()) {
    const notification = new Notification({
      title: localeData.onlineNotificationTitle || 'Internet Connected! 🌐',
      body: localeData.onlineNotificationBody || 'Connection restored successfully. Loading the platform now.',
      icon: notificationIcon,
      silent: false
    })

    notification.on('click', (event) => {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault()
      }
    })

    notification.show()
  }
}

// Handle locale request from splash and offline screens
ipcMain.on('get-splash-locale', (event) => {
  const systemLocale = app.getLocale() || 'en'
  const locale = getLocale(systemLocale)
  event.returnValue = {
    ...locale,
    appVersion: app.getVersion()
  }
})

// Handle media permission response from splash screen
ipcMain.on('media-permission-response', (event, status) => {
  mediaPermissionStatus = status
})

ipcMain.on('get-media-permission-status', (event) => {
  event.returnValue = mediaPermissionStatus
})

// Handle internet restored event from offline screen
ipcMain.on('internet-restored', () => {
  if (isOffline && mainWindow && !mainWindow.isDestroyed()) {
    isOffline = false
    sendInternetRestoredNotification()
    const targetUrl = process.env.APP_URL || 'https://app.tutorhamster.com/'
    mainWindow.loadURL(targetUrl)
  }
})

// Handle manual retry connection
ipcMain.on('retry-connection', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const targetUrl = process.env.APP_URL || 'https://app.tutorhamster.com/'
    mainWindow.loadURL(targetUrl)
  }
})

// Configure electron-updater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

// If GitHub token exists in .env, feed it to autoUpdater for private repo testing
const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
if (ghToken) {
  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'abdelw7abanwr',
      repo: 'TutorHamster-Desktop',
      token: ghToken
    })
  } catch (e) {}
}

let latestDetectedUpdate = null

autoUpdater.on('update-available', (info) => {
  console.log('[UpdateCheck] Update available via autoUpdater:', info.version)
  latestDetectedUpdate = {
    version: info.version,
    releaseNotes: info.releaseNotes || ''
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', latestDetectedUpdate)
  }
})

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-download-progress', {
      percent: Math.floor(progressObj.percent)
    })
  }
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('[UpdateCheck] Update downloaded successfully:', info.version)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded', {
      version: info.version
    })
  }
})

autoUpdater.on('error', (err) => {
  console.log('[UpdateCheck] autoUpdater status/error:', err.message)
  // Seamless fallback to direct GitHub check so modal ALWAYS shows
  checkGitHubReleasesDirectly()
})

// Handle download request from renderer UI
ipcMain.on('start-download-update', (event, { downloadUrl } = {}) => {
  if (app.isPackaged) {
    try {
      autoUpdater.downloadUpdate()
    } catch (e) {
      if (downloadUrl) shell.openExternal(downloadUrl)
    }
  } else if (downloadUrl) {
    shell.openExternal(downloadUrl)
  }
})

// Handle restart & install request
ipcMain.on('quit-and-install-update', () => {
  if (app.isPackaged) {
    autoUpdater.quitAndInstall()
  } else {
    app.relaunch()
    app.quit()
  }
})

// Check for updates function (Packaged & Development fallback)
function checkForAppUpdates () {
  console.log(`[UpdateCheck] Checking for latest releases... (Current App Version: v${app.getVersion()})`)
  if (app.isPackaged) {
    try {
      const p = autoUpdater.checkForUpdates()
      if (p && typeof p.catch === 'function') {
        p.catch(err => {
          console.log('[UpdateCheck] autoUpdater promise error:', err.message)
          checkGitHubReleasesDirectly()
        })
      }
    } catch (err) {
      console.log('[UpdateCheck] autoUpdater check error:', err.message)
      checkGitHubReleasesDirectly()
    }
  } else {
    checkGitHubReleasesDirectly()
  }
}

// GitHub Releases direct API check
function checkGitHubReleasesDirectly () {
  const headers = {
    'User-Agent': 'TutorHamster-Desktop-App'
  }
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (token) {
    headers['Authorization'] = 'Bearer ' + token
  }

  const options = {
    hostname: 'api.github.com',
    path: '/repos/abdelw7abanwr/TutorHamster-Desktop/releases',
    headers
  }

  https.get(options, (res) => {
    let data = ''
    res.on('data', chunk => { data += chunk })
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const releases = JSON.parse(data)
          if (Array.isArray(releases) && releases.length > 0) {
            // Find the latest non-draft release (or newest release)
            const release = releases.find(r => !r.draft) || releases[0]
            const latestTag = (release.tag_name || '').replace(/^v/, '')
            const currentVersion = app.getVersion()
            console.log(`[UpdateCheck] Latest release on GitHub is: ${release.tag_name} | Current Version: v${currentVersion}`)
            if (latestTag && latestTag !== currentVersion) {
              console.log(`[UpdateCheck] New version found (${release.tag_name})! Prompting in-app modal...`)
              latestDetectedUpdate = {
                version: release.tag_name,
                releaseNotes: release.body || '',
                downloadUrl: release.html_url
              }
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-available', latestDetectedUpdate)
              }
            } else {
              console.log(`[UpdateCheck] App is currently up-to-date (v${currentVersion}).`)
            }
          } else {
            console.log('[UpdateCheck] No published releases found on GitHub yet.')
          }
        } catch (e) {
          console.log('[UpdateCheck] JSON parse error:', e.message)
        }
      } else {
        console.log(`[UpdateCheck] GitHub API responded with status ${res.statusCode}.`)
      }
    })
  }).on('error', (err) => {
    console.log('[UpdateCheck] Network error:', err.message)
  })
}

let mainWindow = null
let splashWindow = null

// Helper to check updates specifically for the splash screen
function checkUpdatesForSplash () {
  const currentVersion = app.getVersion()

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash-update-status', {
      state: 'checking',
      currentVersion
    })
  }

  const headers = { 'User-Agent': 'TutorHamster-Desktop-App' }
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (token) headers['Authorization'] = 'Bearer ' + token

  const options = {
    hostname: 'api.github.com',
    path: '/repos/abdelw7abanwr/TutorHamster-Desktop/releases',
    headers
  }

  https.get(options, (res) => {
    let data = ''
    res.on('data', chunk => { data += chunk })
    res.on('end', () => {
      let isUpToDate = true
      let latestVersion = currentVersion

      if (res.statusCode === 200) {
        try {
          const releases = JSON.parse(data)
          if (Array.isArray(releases) && releases.length > 0) {
            const release = releases.find(r => !r.draft) || releases[0]
            const latestTag = (release.tag_name || '').replace(/^v/, '')
            latestVersion = latestTag
            if (latestTag && latestTag !== currentVersion) {
              isUpToDate = false
              latestDetectedUpdate = {
                version: release.tag_name || latestTag,
                releaseNotes: release.body || '',
                downloadUrl: release.html_url
              }
            }
          }
        } catch (e) {}

        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.webContents.send('splash-update-status', {
            state: isUpToDate ? 'up-to-date' : 'update-available',
            currentVersion,
            latestVersion
          })
        }
      } else {
        // Repository check failed or server busy (non-200 response)
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.webContents.send('splash-update-status', {
            state: 'failed',
            currentVersion
          })
        }
      }
    })
  }).on('error', () => {
    // Network or server unreachable
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('splash-update-status', {
        state: 'failed',
        currentVersion
      })
    }
  })
}

function createWindows () {
  // 1. Create Splash Window
  splashWindow = new BrowserWindow({
    width: 820,
    height: 510,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false,
    skipTaskbar: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  splashWindow.loadFile(path.join(__dirname, 'splash.html'))

  splashWindow.once('ready-to-show', () => {
    splashWindow.show()
    checkUpdatesForSplash()
  })

  // 2. Create Main Window in background
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (!appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon)
  }

  // Remove menu bar
  mainWindow.setMenu(null)
  Menu.setApplicationMenu(null)

  // Load URL from environment variables or fallback
  const targetUrl = process.env.APP_URL || 'https://app.tutorhamster.com/'
  mainWindow.loadURL(targetUrl)

  // Toggle Apple loading HUD on page navigation
  mainWindow.webContents.on('did-start-loading', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-apple-loading', true)
    }
  })

  mainWindow.webContents.on('did-stop-loading', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-apple-loading', false)
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-apple-loading', false)
      const currentURL = mainWindow.webContents.getURL()
      if (!currentURL.includes('offline.html')) {
        isOffline = false
        // Send welcome notification if the main window is already shown
        if (mainWindow.isVisible()) {
          sendWelcomeNotification()
        }
        // Ensure in-app update popup appears if an update was detected
        if (latestDetectedUpdate) {
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed() && latestDetectedUpdate) {
              mainWindow.webContents.send('update-available', latestDetectedUpdate)
            }
          }, 1200)
        }
      }
    }
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-apple-loading', false)
      // Ignore user abort or subframe cancellation
      if (errorCode === -3) return
      if (!isOffline) {
        isOffline = true
        mainWindow.loadFile(path.join(__dirname, 'offline.html'))
      }
    }
  })

  // 3. Switch from Splash to Main Window after 10 seconds (10000ms)
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
      // Send welcome notification as soon as the main window opens
      sendWelcomeNotification()
      // Check for updates shortly after main window opens
      setTimeout(() => {
        checkForAppUpdates()
        if (latestDetectedUpdate && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-available', latestDetectedUpdate)
        }
      }, 2500)

      // Periodically check for updates every 30 minutes while the app is running
      setInterval(() => {
        checkForAppUpdates()
      }, 30 * 60 * 1000)
    }
  }, 10000)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  // Automatically grant camera and microphone access to the app
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
      callback(true)
      return
    }
    callback(true)
  })

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
      return true
    }
    return true
  })

  createWindows()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindows()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
