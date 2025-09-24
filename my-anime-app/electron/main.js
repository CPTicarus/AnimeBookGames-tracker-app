import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.whenReady().then(() => {
  const persistentSession = session.fromPartition('persist:anime-tracker');

  let mainWindow;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        session: persistentSession,
      },
    });

    mainWindow.loadURL('http://localhost:5173');
  }

  function createAuthWindow(authUrl, callbackUrlPrefix, successEventName) {
    const authWindow = new BrowserWindow({
      width: 600,
      height: 800,
      parent: mainWindow,
      modal: true,
      show: true,
      webPreferences: {
        session: persistentSession,
      },
    });

    authWindow.loadURL(authUrl);

    const interval = setInterval(() => {
      if (authWindow.isDestroyed()) {
        clearInterval(interval);
        return;
      }

      try {
        const currentURL = authWindow.webContents.getURL();
        if (currentURL.startsWith(callbackUrlPrefix)) {
          clearInterval(interval);
          mainWindow.webContents.send(successEventName);
          setTimeout(() => authWindow.close(), 500);
        }
      } catch (error) {
        console.log(error);
      }
    }, 500);
  }

  ipcMain.on('open-login-window', (event, url) => {
    createAuthWindow(
      url,
      'http://127.0.0.1:8000/api/auth/callback/',
      'anilist-link-success'
    );
  });

  ipcMain.on('open-tmdb-login-window', (event, url) => {
    createAuthWindow(
      url,
      'http://127.0.0.1:8000/api/auth/tmdb/callback/',
      'tmdb-link-success'
    );
  });

  ipcMain.on('open-mal-login-window', (event, url) => {
    shell.openExternal(url);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
