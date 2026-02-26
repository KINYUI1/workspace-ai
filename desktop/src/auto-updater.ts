import { BrowserWindow, ipcMain } from 'electron';

/**
 * Auto-updater setup for Workspace AI Desktop.
 *
 * Uses electron-updater when available. Falls back to a no-op if the
 * dependency isn't installed (e.g. during development).
 */
export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  let autoUpdater: any;

  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch {
    console.log('[desktop] electron-updater not installed, skipping auto-update setup');
    // Register no-op IPC handlers so the renderer doesn't throw
    ipcMain.handle('updater:check', () => null);
    ipcMain.handle('updater:install', () => null);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('updater:checking');
  });

  autoUpdater.on('update-available', (info: any) => {
    mainWindow.webContents.send('updater:available', {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('updater:not-available');
  });

  autoUpdater.on('download-progress', (progress: any) => {
    mainWindow.webContents.send('updater:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info: any) => {
    mainWindow.webContents.send('updater:downloaded', {
      version: info.version,
    });
  });

  autoUpdater.on('error', (err: Error) => {
    mainWindow.webContents.send('updater:error', err.message);
  });

  // IPC handlers
  ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates().catch(() => null));
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall());

  // Check on startup (delayed to let the app settle)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);

  // Check every 6 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 6 * 60 * 60 * 1000);
}
