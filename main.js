const { app, BrowserWindow, ipcMain, session, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const os = require('os');

// ===== PERFORMANCE OPTIMIZATIONS =====
// Limit max Chromium processes to reduce RAM usage
app.commandLine.appendSwitch('max-webview-processes', '4');
// Enable GPU acceleration but limit concurrent decode
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,MemorySaver,BatterySaver');
app.commandLine.appendSwitch('disable-features', 'LazyFrameLoading');
// Reduce memory footprint for background pages
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048');
// Limit image cache
app.commandLine.appendSwitch('force-device-scale-factor', '1');

let mainWindow;
const downloads = new Map();

// Auto updater logging
const updaterLog = {
  info: (...args) => console.log('[autoUpdater]', ...args),
  error: (...args) => console.error('[autoUpdater]', ...args)
};
autoUpdater.logger = updaterLog;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Dolphin Browser',
    frame: false,
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#0b0c10',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      sandbox: false,
      backgroundThrottling: true,
      offscreen: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 3000);
  });

  // ===== DOWNLOAD HANDLER =====
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const downloadInfo = {
      id,
      filename: item.getFilename(),
      url: item.getURL(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progressing'
    };
    downloads.set(id, downloadInfo);

    const savePath = path.join(app.getPath('downloads'), item.getFilename());
    item.setSavePath(savePath);

    mainWindow.webContents.send('download-started', downloadInfo);

    item.on('updated', (event, state) => {
      downloadInfo.receivedBytes = item.getReceivedBytes();
      downloadInfo.totalBytes = item.getTotalBytes();
      downloadInfo.state = state;
      mainWindow.webContents.send('download-updated', downloadInfo);
    });

    item.on('done', (event, state) => {
      downloadInfo.state = state;
      mainWindow.webContents.send('download-updated', downloadInfo);
      if (state === 'completed') {
        shell.showItemInFolder(savePath);
      }
    });
  });

  // ===== CLEAR CACHE ON STARTUP =====
  session.defaultSession.clearCache().catch(() => {});

  mainWindow.on('maximize', () => {
    if (mainWindow) mainWindow.webContents.send('window-maximized', true);
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow) mainWindow.webContents.send('window-maximized', false);
  });
}

// ===== AUTO UPDATER EVENTS =====
autoUpdater.on('checking-for-update', () => {
  if (mainWindow) mainWindow.webContents.send('update-status', { status: 'checking' });
});
autoUpdater.on('update-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-status', { status: 'available', version: info.version });
});
autoUpdater.on('update-not-available', () => {
  if (mainWindow) mainWindow.webContents.send('update-status', { status: 'not-available' });
});
autoUpdater.on('download-progress', (progress) => {
  if (mainWindow) mainWindow.webContents.send('update-status', { status: 'downloading', percent: Math.round(progress.percent) });
});
autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-status', { status: 'downloaded', version: info.version });
});
autoUpdater.on('error', (err) => {
  if (mainWindow) mainWindow.webContents.send('update-status', { status: 'error', message: err.message });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ===== IPC HANDLERS =====
ipcMain.handle('get-app-path', (event, name) => app.getPath(name));

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.on('open-external', (event, url) => shell.openExternal(url));
ipcMain.on('minimize-window', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.on('close-window', () => { if (mainWindow) mainWindow.close(); });
ipcMain.handle('is-maximized', () => mainWindow ? mainWindow.isMaximized() : false);
ipcMain.on('new-window', () => createWindow());
ipcMain.on('install-update', () => autoUpdater.quitAndInstall(false, true));
ipcMain.on('check-for-updates', () => autoUpdater.checkForUpdatesAndNotify().catch(() => {}));

// ===== PERFORMANCE IPC =====
ipcMain.handle('get-system-memory', () => {
  return {
    total: os.totalmem(),
    free: os.freemem(),
    used: os.totalmem() - os.freemem()
  };
});

ipcMain.handle('clear-all-cache', async () => {
  await session.defaultSession.clearCache();
  await session.defaultSession.clearStorageData({
    storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
  });
  return true;
});

ipcMain.handle('get-process-memory', async () => {
  const memInfo = process.memoryUsage();
  return {
    rss: memInfo.rss,
    heapTotal: memInfo.heapTotal,
    heapUsed: memInfo.heapUsed,
    external: memInfo.external
  };
});
