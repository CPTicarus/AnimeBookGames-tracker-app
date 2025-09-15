const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openLoginWindow: () => ipcRenderer.send('open-login-window'),
  onLoginSuccess: (callback) => ipcRenderer.on('login-success', callback)
});