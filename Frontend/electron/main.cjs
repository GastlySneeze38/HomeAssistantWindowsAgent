const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.ELECTRON_START_URL !== undefined;

let backendProcess = null;

function startBackend() {
  if (isDev) return;

  const backendPath = path.join(process.resourcesPath, 'backend.exe');
  backendProcess = spawn(backendPath, [], {
    cwd: path.join(process.resourcesPath),
    detached: false,
  });
}

function waitForBackend(retries, resolve) {
  http.get('http://127.0.0.1:3000/health', (res) => {
    if (res.statusCode === 200) {
      resolve(true);
    } else if (retries > 0) {
      setTimeout(() => waitForBackend(retries - 1, resolve), 500);
    } else {
      resolve(false);
    }
  }).on('error', () => {
    if (retries > 0) {
      setTimeout(() => waitForBackend(retries - 1, resolve), 500);
    } else {
      resolve(false);
    }
  });
}

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: '#0f172a',
    webPreferences: { contextIsolation: true },
  });

  Menu.setApplicationMenu(null);

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #0f172a;
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: 24px;
          -webkit-app-region: drag;
        }
        .logo {
          font-size: 40px;
        }
        h1 {
          font-size: 18px;
          font-weight: 600;
          color: #f1f5f9;
        }
        .status {
          font-size: 13px;
          color: #94a3b8;
        }
        .dots span {
          display: inline-block;
          width: 8px;
          height: 8px;
          margin: 0 3px;
          background: #3b82f6;
          border-radius: 50%;
          animation: bounce 1.2s infinite ease-in-out;
        }
        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      </style>
    </head>
    <body>
      <div class="logo">🏠</div>
      <h1>HomeAssistant Windows Agent</h1>
      <p class="status">Démarrage du backend...</p>
      <div class="dots"><span></span><span></span><span></span></div>
    </body>
    </html>
  `)}`);

  return splash;
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  if (isDev) {
    win.loadURL(process.env.ELECTRON_START_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return win;
}

app.whenReady().then(async () => {
  startBackend();

  const splash = createSplashWindow();
  const win = createMainWindow();

  const ready = await new Promise((resolve) => waitForBackend(40, resolve));

  win.once('ready-to-show', () => {
    splash.close();
    win.show();
  });

  if (!ready) {
    splash.close();
    win.show();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
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
