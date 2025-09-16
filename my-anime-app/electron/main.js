import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.whenReady().then(() => {
  const persistentSession = session.fromPartition('persist:anime-tracker');

  function createWindow() {
    const mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        session: persistentSession,
      },
    });

    mainWindow.loadURL('http://localhost:5173');

    ipcMain.on('open-login-window', (event, url) => {
      const loginWindow = new BrowserWindow({
        width: 600,
        height: 800,
        parent: mainWindow,
        modal: true,
        show: true,
        webPreferences: {
          session: persistentSession,
        },
      });
      loginWindow.loadURL(url);

      const interval = setInterval(async () => {
        if (loginWindow.isDestroyed()) {
          clearInterval(interval);
          return;
        }

        const currentURL = loginWindow.webContents.getURL();

        if (currentURL.startsWith('http://127.0.0.1:8000/api/auth/callback/')) {
          clearInterval(interval);

          const json = await loginWindow.webContents.executeJavaScript('document.body.innerText');
          const tokenData = JSON.parse(json);
          const appToken = tokenData.token;

          if (appToken) {
            mainWindow.webContents.send('login-success', appToken);
          }

          loginWindow.close();
        }
      }, 500);
    });
  }

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