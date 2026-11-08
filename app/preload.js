/**
 * Preload script for TutorHamster Main Window
 * Displays an authentic Apple Loading Indicator HUD in the center of the screen
 * during page navigation and heavy network operations.
 */
const { ipcRenderer, contextBridge } = require('electron')

// Safely bridge localized strings and network API for offline screen
try {
  const localeData = ipcRenderer.sendSync('get-splash-locale')
  contextBridge.exposeInMainWorld('offlineLocale', localeData)
} catch (e) {}

contextBridge.exposeInMainWorld('offlineAPI', {
  notifyInternetRestored: () => ipcRenderer.send('internet-restored'),
  retryConnection: () => ipcRenderer.send('retry-connection')
})

const isOfflinePage = window.location.href.includes('offline.html')

let hudHost = null
let shadowRoot = null
let activeRequests = 0
let loadingTimer = null

function createAppleHUD() {
  if (hudHost) return hudHost
  if (isOfflinePage) return null

  hudHost = document.createElement('tutor-apple-hud')
  shadowRoot = hudHost.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.22s;
    }
    :host(.active) {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    .hud-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.08);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }
    .hud-card {
      position: relative;
      width: 90px;
      height: 90px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(30px) saturate(180%);
      -webkit-backdrop-filter: blur(30px) saturate(180%);
      box-shadow: 
        0 20px 45px -10px rgba(0, 0, 0, 0.18),
        0 0 0 1px rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      transform: scale(0.92);
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    :host(.active) .hud-card {
      transform: scale(1);
    }
    @media (prefers-color-scheme: dark) {
      .hud-card {
        background: rgba(32, 32, 36, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      }
    }
    /* 12-Blade Authentic Apple Activity Indicator Spinner */
    .apple-spinner {
      position: relative;
      width: 34px;
      height: 34px;
    }
    .apple-spinner div {
      width: 9%;
      height: 27%;
      background: #1d1d1f;
      position: absolute;
      left: 45.5%;
      top: 36.5%;
      opacity: 0;
      border-radius: 50px;
      animation: appleFade 1.2s linear infinite;
    }
    @media (prefers-color-scheme: dark) {
      .apple-spinner div {
        background: #f5f5f7;
      }
    }
    .bar1  { transform: rotate(0deg) translate(0, -135%); animation-delay: 0s; }
    .bar2  { transform: rotate(30deg) translate(0, -135%); animation-delay: -1.1s; }
    .bar3  { transform: rotate(60deg) translate(0, -135%); animation-delay: -1.0s; }
    .bar4  { transform: rotate(90deg) translate(0, -135%); animation-delay: -0.9s; }
    .bar5  { transform: rotate(120deg) translate(0, -135%); animation-delay: -0.8s; }
    .bar6  { transform: rotate(150deg) translate(0, -135%); animation-delay: -0.7s; }
    .bar7  { transform: rotate(180deg) translate(0, -135%); animation-delay: -0.6s; }
    .bar8  { transform: rotate(210deg) translate(0, -135%); animation-delay: -0.5s; }
    .bar9  { transform: rotate(240deg) translate(0, -135%); animation-delay: -0.4s; }
    .bar10 { transform: rotate(270deg) translate(0, -135%); animation-delay: -0.3s; }
    .bar11 { transform: rotate(300deg) translate(0, -135%); animation-delay: -0.2s; }
    .bar12 { transform: rotate(330deg) translate(0, -135%); animation-delay: -0.1s; }

    @keyframes appleFade {
      from { opacity: 1; }
      to { opacity: 0.15; }
    }
  `

  const backdrop = document.createElement('div')
  backdrop.className = 'hud-backdrop'

  const card = document.createElement('div')
  card.className = 'hud-card'

  const spinner = document.createElement('div')
  spinner.className = 'apple-spinner'
  for (let i = 1; i <= 12; i++) {
    const bar = document.createElement('div')
    bar.className = 'bar' + i
    spinner.appendChild(bar)
  }

  card.appendChild(spinner)
  shadowRoot.appendChild(style)
  shadowRoot.appendChild(backdrop)
  shadowRoot.appendChild(card)

  return hudHost
}

function showLoader() {
  if (isOfflinePage) return
  const hud = createAppleHUD()
  if (!hud) return
  if (!document.body && document.documentElement) {
    document.documentElement.appendChild(hud)
  } else if (document.body && !hud.parentElement) {
    document.body.appendChild(hud)
  }
  hud.classList.add('active')
}

function hideLoader() {
  if (hudHost) {
    hudHost.classList.remove('active')
  }
}

// 1. Initial page load display
showLoader()

// 2. Hide on DOM ready / complete
window.addEventListener('DOMContentLoaded', () => {
  const hud = createAppleHUD()
  if (document.body && !hud.parentElement) {
    document.body.appendChild(hud)
  }
  // Short delay for smoothness
  setTimeout(hideLoader, 200)
})

window.addEventListener('load', () => {
  setTimeout(hideLoader, 150)
})

// 3. Show immediately on navigation (link clicks or page unload)
window.addEventListener('beforeunload', () => {
  showLoader()
})

// 4. Handle Electron Main Process IPC events
ipcRenderer.on('toggle-apple-loading', (event, isLoading) => {
  if (isLoading) {
    showLoader()
  } else {
    setTimeout(hideLoader, 150)
  }
})

// 5. Monitor AJAX / Fetch requests with delay threshold to capture heaviness (التقل)
const originalFetch = window.fetch
if (typeof originalFetch === 'function') {
  window.fetch = async function (...args) {
    activeRequests++
    if (!loadingTimer) {
      // Show loader if the request takes more than 350ms (perceptible heaviness)
      loadingTimer = setTimeout(() => {
        if (activeRequests > 0) showLoader()
      }, 350)
    }

    try {
      return await originalFetch.apply(this, args)
    } finally {
      activeRequests--
      if (activeRequests <= 0) {
        activeRequests = 0
        if (loadingTimer) {
          clearTimeout(loadingTimer)
          loadingTimer = null
        }
        setTimeout(hideLoader, 150)
      }
    }
  }
}

// ==========================================
// Apple-style In-App Auto-Update Notification
// ==========================================
let updateModalHost = null
let updateModalShadow = null
let currentUpdateInfo = null

function createUpdateModal() {
  if (updateModalHost) return updateModalHost

  const locale = (window.offlineLocale || {
    dir: 'rtl',
    updateAvailableTitle: 'تحديث جديد متوفر! 🚀',
    updateAvailableDesc: 'يتوفر إصدار جديد ({version}) يحتوي على تحسينات ومزايا جديدة. هل ترغب في تنزيله الآن؟',
    updateDownloadBtn: 'تنزيل التحديث',
    updateLaterBtn: 'لاحقاً',
    updateDownloading: 'جاري تنزيل التحديث...',
    updateReadyTitle: 'التحديث جاهز للتثبيت! 🎉',
    updateReadyDesc: 'تم تنزيل التحديث بنجاح. هل تريد إعادة تشغيل التطبيق وتثبيته الآن؟',
    updateRestartBtn: 'إعادة التشغيل والتثبيت'
  })

  updateModalHost = document.createElement('tutor-apple-update-modal')
  updateModalShadow = updateModalHost.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: 'Baloo Bhaijaan 2', -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
    }
    :host(.active) {
      opacity: 1;
      pointer-events: auto;
    }
    .modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.35);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .modal-card {
      position: relative;
      width: 440px;
      max-width: 90vw;
      background: #ffffff;
      border-radius: 22px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.04);
      padding: 26px 28px 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;
      transform: scale(0.94);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    :host(.active) .modal-card {
      transform: scale(1);
    }
    .icon-badge {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: rgba(0, 113, 227, 0.1);
      color: #0071e3;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-badge svg {
      width: 26px;
      height: 26px;
      stroke-width: 2;
    }
    .modal-title {
      font-size: 19px;
      font-weight: 800;
      color: #1d1d1f;
      line-height: 1.25;
      margin: 0;
    }
    .modal-desc {
      font-size: 14px;
      color: #6e6e73;
      line-height: 1.5;
      margin: 0;
    }
    .progress-box {
      width: 100%;
      display: none;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
    }
    .progress-track {
      width: 100%;
      height: 6px;
      background: rgba(0, 0, 0, 0.08);
      border-radius: 999px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #0071e3, #4f46e5);
      border-radius: 999px;
      transition: width 0.1s linear;
    }
    .progress-label {
      font-size: 12px;
      font-weight: 600;
      color: #86868b;
    }
    .modal-actions {
      display: flex;
      width: 100%;
      gap: 10px;
      margin-top: 6px;
    }
    .btn {
      flex: 1;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      border: none;
      outline: none;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-primary {
      background: #0071e3;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(0, 113, 227, 0.3);
    }
    .btn-primary:hover {
      background: #0077ed;
      box-shadow: 0 6px 16px rgba(0, 113, 227, 0.4);
    }
    .btn-secondary {
      background: #f5f5f7;
      color: #6e6e73;
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    .btn-secondary:hover {
      background: #e5e5ea;
      color: #1d1d1f;
    }
  `

  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'

  const card = document.createElement('div')
  card.className = 'modal-card'
  card.setAttribute('dir', locale.dir || 'ltr')

  card.innerHTML = `
    <div class="icon-badge">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
      </svg>
    </div>
    <h2 class="modal-title" id="update-title">${locale.updateAvailableTitle || 'New Update Available!'}</h2>
    <p class="modal-desc" id="update-desc">${locale.updateAvailableDesc || 'A new update is available.'}</p>
    <div class="progress-box" id="update-progress-box">
      <div class="progress-track">
        <div class="progress-fill" id="update-progress-fill"></div>
      </div>
      <span class="progress-label" id="update-progress-label">${locale.updateDownloading || 'Downloading...'}</span>
    </div>
    <div class="modal-actions" id="update-actions">
      <button class="btn btn-primary" id="btn-update-download">${locale.updateDownloadBtn || 'Download Update'}</button>
      <button class="btn btn-secondary" id="btn-update-later">${locale.updateLaterBtn || 'Later'}</button>
    </div>
  `

  updateModalShadow.appendChild(style)
  updateModalShadow.appendChild(backdrop)
  updateModalShadow.appendChild(card)

  const btnDownload = updateModalShadow.getElementById('btn-update-download')
  const btnLater = updateModalShadow.getElementById('btn-update-later')
  const progressBox = updateModalShadow.getElementById('update-progress-box')

  btnDownload.addEventListener('click', () => {
    if (btnDownload.dataset.state === 'ready') {
      ipcRenderer.send('quit-and-install-update')
    } else {
      btnDownload.style.display = 'none'
      btnLater.style.display = 'none'
      progressBox.style.display = 'flex'
      ipcRenderer.send('start-download-update', currentUpdateInfo || {})
    }
  })

  btnLater.addEventListener('click', () => {
    updateModalHost.classList.remove('active')
  })

  return updateModalHost
}

ipcRenderer.on('update-available', (event, info) => {
  if (isOfflinePage) return
  currentUpdateInfo = info
  const host = createUpdateModal()
  if (!document.body && document.documentElement) {
    document.documentElement.appendChild(host)
  } else if (document.body && !host.parentElement) {
    document.body.appendChild(host)
  }

  const locale = window.offlineLocale || {}
  const descEl = updateModalShadow.getElementById('update-desc')
  if (descEl && locale.updateAvailableDesc) {
    descEl.innerText = locale.updateAvailableDesc.replace('{version}', info.version || '')
  }

  host.classList.add('active')
})

ipcRenderer.on('update-download-progress', (event, { percent }) => {
  if (!updateModalShadow) return
  const fill = updateModalShadow.getElementById('update-progress-fill')
  const label = updateModalShadow.getElementById('update-progress-label')
  const locale = window.offlineLocale || {}
  if (fill) fill.style.width = percent + '%'
  if (label) label.innerText = `${locale.updateDownloading || 'Downloading...'} ${percent}%`
})

ipcRenderer.on('update-downloaded', (event, { version }) => {
  if (!updateModalShadow) return
  const locale = window.offlineLocale || {}
  const titleEl = updateModalShadow.getElementById('update-title')
  const descEl = updateModalShadow.getElementById('update-desc')
  const progressBox = updateModalShadow.getElementById('update-progress-box')
  const btnDownload = updateModalShadow.getElementById('btn-update-download')
  const btnLater = updateModalShadow.getElementById('btn-update-later')

  if (titleEl) titleEl.innerText = locale.updateReadyTitle || 'Update Ready! 🎉'
  if (descEl) descEl.innerText = locale.updateReadyDesc || 'Restart to install.'
  if (progressBox) progressBox.style.display = 'none'

  if (btnDownload) {
    btnDownload.innerText = locale.updateRestartBtn || 'Restart & Install'
    btnDownload.dataset.state = 'ready'
    btnDownload.style.display = 'flex'
  }
  if (btnLater) btnLater.style.display = 'flex'
})
