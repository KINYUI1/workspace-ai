import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { showMainWindow, destroyMainWindow, getMainWindow } from './window';

let tray: Tray | null = null;

/**
 * Create the system tray icon with context menu.
 */
export function createTray(): Tray {
  // Try loading icon from resources, fall back to a programmatic icon
  const iconPath = path.join(__dirname, '..', 'resources', 'icon.png');
  let icon: Electron.NativeImage;

  try {
    const fs = require('fs');
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
      icon = icon.resize({ width: 16, height: 16 });
    } else {
      // Create a simple 16x16 tray icon programmatically (indigo square with white dots)
      icon = nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAhElEQVQ4T2NkoBAwUqifgWoGMIIc' +
        'wMDAwPD//38GBgYGBkZGRgZGRsb/DAwMDP///2f4////fwYGBgYGJiYmBiYmpv8MDAwMDP/+/WNg+PePgeH/fwYGRkYGRiYm' +
        'BkYmpv8MDAwMDP/+/WP4/+8fA8O/fwwMjIwMjExMDIxMTP8ZGBgYAACvJB8RhEhpHAAAAABJRU5ErkJggg==',
      );
    }
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  updateTrayMenu();

  // Click tray icon to toggle window visibility
  tray.on('click', () => {
    const win = getMainWindow();
    if (win?.isVisible() && win?.isFocused()) {
      win.hide();
    } else {
      showMainWindow();
    }
  });

  return tray;
}

/**
 * Update the tray context menu (can be called to refresh dynamic items).
 */
function updateTrayMenu(): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Workspace AI',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'New Chat',
      accelerator: 'CommandOrControl+Shift+N',
      click: () => {
        showMainWindow();
        const win = getMainWindow();
        win?.webContents.send('shortcut:new-chat');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        destroyMainWindow();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Update the tray tooltip to show agent status.
 */
export function updateTrayTooltip(status: string): void {
  if (tray) {
    tray.setToolTip(`Workspace AI — ${status}`);
  }
}

/**
 * Destroy the tray icon.
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
