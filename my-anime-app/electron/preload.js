const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // AniList functions
  openLoginWindow: (url) => ipcRenderer.send('open-login-window', url),

  // Keep existing app-login channel (if you use it somewhere else)
  onLoginSuccess: (callback) => ipcRenderer.on('login-success', callback),

  // New: AniList-specific success event (avoid collision with app-level login)
  onAnilistLinkSuccess: (callback) => ipcRenderer.on('anilist-link-success', callback),

  // TMDB functions
  openTmdbLoginWindow: (url) => ipcRenderer.send('open-tmdb-login-window', url),
  onTmdbLinkSuccess: (callback) => ipcRenderer.on('tmdb-link-success', callback),

  // MAL functions
  openMalLoginWindow: (url) => ipcRenderer.send('open-mal-login-window', url),
  onMalLinkSuccess: (callback) => ipcRenderer.on('mal-link-success', callback),
});