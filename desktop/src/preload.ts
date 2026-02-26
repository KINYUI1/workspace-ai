import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script — exposes a safe IPC bridge to the renderer process.
 * The frontend can detect desktop mode via window.electronAPI.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /** True when running inside the desktop Electron shell. */
  isDesktop: true,

  /** Get the desktop config (safe subset, no secrets). */
  getConfig: () => ipcRenderer.invoke('get-config'),

  /** Open a URL in the system browser. */
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  /** Show a native desktop notification. */
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('show-notification', title, body),

  /** Get the app version. */
  getVersion: () => ipcRenderer.invoke('get-version'),
});
