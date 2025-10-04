import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess;

function createWindow() {
  const persistentSession = session.fromPartition('persist:anime-tracker');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      session: persistentSession,
    },
  });

  // In production, load the built frontend
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

function createAuthWindow(authUrl, callbackUrlPrefix, successEventName) {
  const persistentSession = session.fromPartition('persist:anime-tracker');

  const authWindow = new BrowserWindow({
    width: 600,
    height: 800,
    parent: mainWindow,
    modal: true,
    show: true,
    webPreferences: {
      session: persistentSession,
      nodeIntegration: false,
      contextIsolation: true,
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

app.whenReady().then(() => {
  // Start Django backend (exe bundled with extraResources)
  const backendPath = path.join(process.resourcesPath, 'backend', 'run_backend.exe');

  backendProcess = spawn(backendPath, [], {
    detached: false,
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Django] ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Django ERROR] ${data}`);
  });

  createWindow();

  ipcMain.on('open-login-window', (_event, url) => {
    createAuthWindow(url, 'http://127.0.0.1:8000/api/auth/callback/', 'anilist-link-success');
  });

  ipcMain.on('open-tmdb-login-window', (_event, url) => {
    createAuthWindow(url, 'http://127.0.0.1:8000/api/auth/tmdb/callback/', 'tmdb-link-success');
  });

  ipcMain.on('open-mal-login-window', (_event, url) => {
    shell.openExternal(url);
  });

  ipcMain.on('open-steam-login-window', (_event, url) => {
    createAuthWindow(url, 'http://127.0.0.1:8000/api/auth/steam/callback/', 'steam-link-success');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});
