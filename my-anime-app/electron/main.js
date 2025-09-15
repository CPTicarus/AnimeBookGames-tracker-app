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

    ipcMain.on('open-login-window', () => {
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
    loginWindow.loadURL('http://127.0.0.1:8000/api/auth/login/');

    // This is the new, more robust method
    const interval = setInterval(async () => {
        if (loginWindow.isDestroyed()) {
        clearInterval(interval);
        return;
        }

        const currentURL = loginWindow.webContents.getURL();

        if (currentURL.startsWith('http://127.0.0.1:8000/api/auth/callback/')) {
        // Stop checking
        clearInterval(interval);

        // Grab the JSON content from the page
        const json = await loginWindow.webContents.executeJavaScript('document.body.innerText');
        const tokenData = JSON.parse(json);
        const accessToken = tokenData.access_token;

        // Send the token to the main window
        if (accessToken) {
            mainWindow.webContents.send('login-success', accessToken);
        }

        // Close the window
        loginWindow.close();
        }
    }, 500); // Check the URL every 500 milliseconds
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