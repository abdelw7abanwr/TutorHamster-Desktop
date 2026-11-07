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
