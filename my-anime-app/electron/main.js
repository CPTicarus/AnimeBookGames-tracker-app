import { app, BrowserWindow, ipcMain } from 'electron'; // Add ipcMain
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const mainWindow = new BrowserWindow({ // Renamed to mainWindow
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Listen for the request to open the login window
  ipcMain.on('open-login-window', () => {
    const loginWindow = new BrowserWindow({ width: 600, height: 800, parent: mainWindow, modal: true });
    loginWindow.loadURL('http://127.0.0.1:8000/api/auth/login/');

    // Check if the login was successful by monitoring for the callback URL
    loginWindow.webContents.on('will-redirect', (event, url) => {
      if (url.startsWith('http://127.0.0.1:8000/api/auth/callback/')) {
        loginWindow.close();
        // Tell the main window that login was successful
        mainWindow.webContents.send('login-success');
      }
    });
  });
}

app.whenReady().then(createWindow);