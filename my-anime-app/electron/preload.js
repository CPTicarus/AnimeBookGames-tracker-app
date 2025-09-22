const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // AniList functions
  openLoginWindow: (url) => ipcRenderer.send('open-login-window', url),
  onLoginSuccess: (callback) => ipcRenderer.on('login-success', callback),

  // TMDB functions
  openTmdbLoginWindow: (url) => ipcRenderer.send('open-tmdb-login-window', url),
  onTmdbLinkSuccess: (callback) => ipcRenderer.on('tmdb-link-success', callback),
});