const { contextBridge, ipcRenderer } = require('electron')

// Safely fetch and expose the system-detected locale data
try {
  const localeData = ipcRenderer.sendSync('get-splash-locale')
  contextBridge.exposeInMainWorld('splashLocale', localeData)
} catch (err) {
  console.error('Failed to communicate with main process for locale:', err)
}

// Media permissions communication bridge
contextBridge.exposeInMainWorld('splashAPI', {
  sendPermissionResponse: (status) => ipcRenderer.send('media-permission-response', status),
  getPermissionStatus: () => ipcRenderer.sendSync('get-media-permission-status')
})
