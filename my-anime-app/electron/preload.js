const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // AniList functions
  openLoginWindow: (url) => ipcRenderer.send('open-login-window', url),
  onAnilistLinkSuccess: (callback) => ipcRenderer.on('anilist-link-success', callback),

  // existing app-login channel
  onLoginSuccess: (callback) => ipcRenderer.on('login-success', callback),

  // TMDB functions
  openTmdbLoginWindow: (url) => ipcRenderer.send('open-tmdb-login-window', url),
  onTmdbLinkSuccess: (callback) => ipcRenderer.on('tmdb-link-success', callback),

  // MAL functions
  openMalLoginWindow: (url) => ipcRenderer.send('open-mal-login-window', url),
  onMalLinkSuccess: (callback) => ipcRenderer.on('mal-link-success', callback),

  // Steam functions
  openSteamLoginWindow: (url) => ipcRenderer.send('open-steam-login-window', url),
  onSteamLinkSuccess: (callback) => ipcRenderer.on('steam-link-success', callback),
  onSteamLinkSuccess: (callback) => ipcRenderer.on('steam-link-success', callback),
});