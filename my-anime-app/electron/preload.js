const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openLoginWindow: (url) => ipcRenderer.send('open-login-window', url),
  onLoginSuccess: (callback) => ipcRenderer.on('login-success', callback)
});