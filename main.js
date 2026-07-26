const { app, BrowserWindow, utilityProcess } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs');
const os = require('os');

// ── File-based debug log ─────────────────────────────────────────────────────
const logDir = path.join(os.homedir(), 'Library', 'Logs', 'PDFLeader');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logPath = path.join(logDir, 'debug.log');

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(logPath, line); } catch (_) {}
}

log('=== PDFLeader starting ===');
log('isPackaged:', app.isPackaged);
log('resourcesPath:', process.resourcesPath);

// ── Path resolution ──────────────────────────────────────────────────────────
const SERVER_PORT = 3001;

function getServerPaths() {
  if (app.isPackaged) {
    // extraResources copies server/ and client/dist/ directly into Resources/
    const res = process.resourcesPath;
    return {
      script:     path.join(res, 'server', 'index.js'),
      clientDist: path.join(res, 'client', 'dist'),
    };
  }
  return {
    script:     path.join(__dirname, 'server', 'index.js'),
    clientDist: path.join(__dirname, 'client', 'dist'),
  };
}

// ── Server lifecycle ─────────────────────────────────────────────────────────
let serverProcess;

function startServer() {
  const { script, clientDist } = getServerPaths();

  log('server script :', script);
  log('script exists :', fs.existsSync(script));
  log('clientDist    :', clientDist);
  log('clientDist ok :', fs.existsSync(clientDist));

  const serverDir = path.dirname(script);
  try {
    const entries = fs.readdirSync(serverDir);
    log('server dir entries:', entries.join(', '));
    const hasNodeModules = entries.includes('node_modules');
    log('node_modules present:', hasNodeModules);
    if (hasNodeModules) {
      log('node_modules contents:', fs.readdirSync(path.join(serverDir, 'node_modules')).join(', '));
    }
  } catch (e) {
    log('ERROR reading server dir:', e.message);
  }

  try {
    serverProcess = utilityProcess.fork(script, [], {
      stdio: 'pipe',
      env: {
        ...process.env,
        ELECTRON_USER_DATA: app.getPath('userData'),
        CLIENT_DIST_PATH: clientDist,
      },
    });

    serverProcess.on('spawn', () => log('✓ server process spawned'));

    if (serverProcess.stdout) {
      serverProcess.stdout.on('data', (d) => log('[server]', d.toString().trim()));
    }
    if (serverProcess.stderr) {
      serverProcess.stderr.on('data', (d) => log('[server-err]', d.toString().trim()));
    }
    serverProcess.on('exit', (code, signal) => log(`server exited — code=${code} signal=${signal}`));
  } catch (e) {
    log('FATAL: failed to fork server:', e.message);
  }
}

// ── Wait for server to accept connections ────────────────────────────────────
function waitForServer(callback, attempts = 0) {
  const socket = new net.Socket();
  socket.connect(SERVER_PORT, '127.0.0.1', () => {
    socket.destroy();
    log(`✓ server ready after ${attempts} attempt(s)`);
    callback();
  });
  socket.on('error', () => {
    socket.destroy();
    if (attempts < 40) {
      setTimeout(() => waitForServer(callback, attempts + 1), 250);
    } else {
      log('WARN: server not ready after 10 s — loading anyway');
      callback();
    }
  });
}

// ── Window ───────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'PDFLeader',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  waitForServer(() => {
    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
    mainWindow.show();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App events ───────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
