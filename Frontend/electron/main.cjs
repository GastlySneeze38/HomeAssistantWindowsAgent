const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = process.env.ELECTRON_START_URL !== undefined;

let backendProcess = null;

function startBackend() {
  if (isDev) return; // En dev, le backend tourne séparément

  const backendPath = path.join(process.resourcesPath, 'backend.exe');
  backendProcess = spawn(backendPath, [], {
    cwd: path.join(process.resourcesPath),
    detached: false,
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Supprime complètement la barre de menu
  Menu.setApplicationMenu(null);

  if (isDev) {
    win.loadURL(process.env.ELECTRON_START_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
