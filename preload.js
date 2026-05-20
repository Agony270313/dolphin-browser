const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onDownloadStarted: (callback) => ipcRenderer.on('download-started', (event, data) => callback(data)),
  onDownloadUpdated: (callback) => ipcRenderer.on('download-updated', (event, data) => callback(data)),
  removeDownloadListeners: () => {
    ipcRenderer.removeAllListeners('download-started');
    ipcRenderer.removeAllListeners('download-updated');
  },
  getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  onMaximizedChange: (callback) => ipcRenderer.on('window-maximized', (event, value) => callback(value)),
  newWindow: () => ipcRenderer.send('new-window'),

  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, data) => callback(data)),
  removeUpdateListeners: () => ipcRenderer.removeAllListeners('update-status'),
  installUpdate: () => ipcRenderer.send('install-update'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
});
