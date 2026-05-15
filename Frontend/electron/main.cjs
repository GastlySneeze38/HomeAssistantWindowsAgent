const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.ELECTRON_START_URL !== undefined;

let backendProcess = null;
let splashWindow = null;

function pushLog(message, isError = false) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const escaped = message.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  splashWindow.webContents.executeJavaScript(`addLog(\`${escaped}\`, ${isError})`).catch(() => {});
}

function startBackend() {
  if (isDev) return;

  const backendPath = path.join(process.resourcesPath, 'backend.exe');
  backendProcess = spawn(backendPath, [], {
    cwd: path.join(process.resourcesPath),
    detached: false,
  });

  backendProcess.stdout.on('data', (data) => {
    data.toString().split('\n').filter(l => l.trim()).forEach(line => pushLog(line, false));
  });

  backendProcess.stderr.on('data', (data) => {
    data.toString().split('\n').filter(l => l.trim()).forEach(line => pushLog(line, true));
  });

  backendProcess.on('exit', (code) => {
    if (code !== 0) pushLog(`Backend exited with code ${code}`, true);
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
    width: 600,
    height: 400,
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
          height: 100vh;
          -webkit-app-region: drag;
        }
        header {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 28px 24px 16px;
          gap: 8px;
          border-bottom: 1px solid #1e293b;
        }
        .logo { font-size: 32px; }
        h1 { font-size: 16px; font-weight: 600; color: #f1f5f9; }
        .status-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #94a3b8;
        }
        .dots span {
          display: inline-block;
          width: 6px; height: 6px;
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
        #log {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
          font-family: 'Consolas', 'Courier New', monospace;
          font-size: 11px;
          line-height: 1.6;
          background: #020c1a;
          -webkit-app-region: no-drag;
        }
        #log::-webkit-scrollbar { width: 4px; }
        #log::-webkit-scrollbar-track { background: transparent; }
        #log::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .log-line { color: #64748b; }
        .log-line.normal { color: #94a3b8; }
        .log-line.error { color: #f87171; }
        .log-line::before {
          content: '> ';
          color: #334155;
        }
      </style>
    </head>
    <body>
      <header>
        <div class="logo">🏠</div>
        <h1>HomeAssistant Windows Agent</h1>
        <div class="status-row">
          <span>Démarrage du backend</span>
          <div class="dots"><span></span><span></span><span></span></div>
        </div>
      </header>
      <div id="log"><div class="log-line">En attente du backend...</div></div>
      <script>
        function addLog(message, isError) {
          const log = document.getElementById('log');
          const line = document.createElement('div');
          line.className = 'log-line ' + (isError ? 'error' : 'normal');
          line.textContent = message;
          log.appendChild(line);
          log.scrollTop = log.scrollHeight;
        }
      </script>
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
    const indexPath = path.join(__dirname, '../dist/index.html');
    win.loadFile(indexPath).catch((err) => {
      win.loadURL(`data:text/html,<pre style="color:red;font-family:monospace">Erreur chargement UI:<br>${encodeURIComponent(String(err))}<br><br>Chemin: ${encodeURIComponent(indexPath)}</pre>`);
    });
  }

  return win;
}

app.whenReady().then(async () => {
  splashWindow = createSplashWindow();
  startBackend();

  const win = createMainWindow();

  const [ready, windowReady] = await Promise.all([
    new Promise((resolve) => waitForBackend(40, resolve)),
    new Promise((resolve) => win.once('ready-to-show', resolve)),
  ]);

  splashWindow.close();
  win.show();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
