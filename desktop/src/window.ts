import { BrowserWindow, shell } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

/**
 * Create the main application window.
 */
export function createMainWindow(port: number): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Workspace AI',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the app from the local Express server
  mainWindow.loadURL(`http://localhost:${port}`);

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Get the current main window instance.
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Show the main window (restore from tray).
 */
export function showMainWindow(): void {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}

/**
 * Toggle the main window visibility.
 */
export function toggleMainWindow(): void {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  }
}

/**
 * Force-close the main window (on app quit).
 */
export function destroyMainWindow(): void {
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
    mainWindow = null;
  }
}
