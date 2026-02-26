import { app, ipcMain, shell, Notification, BrowserWindow, globalShortcut } from 'electron';
import { createServer } from 'http';
import path from 'path';
import {
  loadConfig,
  ensureDataDir,
  injectEnvFromConfig,
  isFirstRun,
  getDatabasePath,
  getDataDir,
} from './config';
import { getDesktopPrismaClient, disconnectDesktopDatabase } from './database';
import { createMainWindow, destroyMainWindow, getMainWindow } from './window';
import { createTray, destroyTray } from './tray';
import { cancelAllJobs } from './local-scheduler';
import { setupAutoUpdater } from './auto-updater';

// ---------------------------------------------------------------------------
// Workspace AI Desktop — Electron Main Process
//
// Boots the Express server inside Electron's main process, opens the
// React frontend in a BrowserWindow, and provides system tray integration.
// ---------------------------------------------------------------------------

let serverCleanup: (() => Promise<void>) | null = null;

/**
 * Register tsx so we can require() backend TypeScript modules at runtime.
 */
function registerTsLoader(): void {
  try {
    require('tsx/cjs/api').register();
  } catch {
    try {
      require('ts-node').register({
        transpileOnly: true,
        compilerOptions: { module: 'commonjs' },
      });
    } catch {
      console.warn('[desktop] No TS loader found — backend must be pre-compiled');
    }
  }
}

/**
 * Start the backend Express server.
 * Uses require() for backend imports to avoid rootDir conflicts —
 * the backend is built separately and loaded at runtime.
 */
async function startServer(port: number): Promise<void> {
  // Inject env vars from desktop config before loading backend modules
  injectEnvFromConfig();

  // Register TS loader so require() can handle .ts files
  registerTsLoader();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const backendRoot = path.resolve(__dirname, '..', '..', 'backend', 'src');

  // Connect to SQLite database using desktop-specific Prisma client
  const prisma = getDesktopPrismaClient();
  await prisma.$connect();
  console.log('[desktop] SQLite database connected at', getDatabasePath());

  // Inject the desktop SQLite client into the backend's database module
  // so all backend code uses SQLite instead of PostgreSQL
  const { setPrismaClient } = require(path.join(backendRoot, 'config', 'database'));
  setPrismaClient(prisma);

  const { createApp } = require(path.join(backendRoot, 'app'));
  const { initializeWebSocket } = require(
    path.join(backendRoot, 'core', 'communication', 'websocket'),
  );
  const { SyncScheduler } = require(
    path.join(backendRoot, 'core', 'communication', 'sync-scheduler'),
  );

  // Seed default user if first run
  await seedDesktopUser(prisma);

  // Create Express app (skip 404 catch-all — we add SPA fallback below)
  const expressApp = createApp({ skipCatchAll: true });

  // Serve the frontend build as static files
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  const express = require('express');
  expressApp.use(express.static(frontendDist));

  // SPA fallback — serve index.html for all non-API routes
  expressApp.get('*', (_req: any, res: any) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  const httpServer = createServer(expressApp);

  // Initialize WebSocket
  initializeWebSocket(httpServer);

  // Start sync scheduler (20-minute cycle)
  const config = loadConfig();
  const apiKey = config.llm.anthropicApiKey || 'sk-placeholder';
  const syncScheduler = new SyncScheduler(apiKey, 20);
  syncScheduler.start();

  // Listen
  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => {
      console.log(`[desktop] Server running at http://localhost:${port}`);
      resolve();
    });
  });

  // Store cleanup function for graceful shutdown
  serverCleanup = async () => {
    syncScheduler.stop();
    cancelAllJobs();
    httpServer.close();
    await disconnectDesktopDatabase();
  };
}

/**
 * Ensure a default local user exists in the database.
 */
async function seedDesktopUser(prisma: any): Promise<void> {
  const config = loadConfig();
  const email = config.internal.defaultUserEmail;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  // Create user with a dummy hashed password (auth is bypassed in desktop mode)
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('desktop-local', 12);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: config.internal.defaultUserName,
      settings: JSON.stringify({}),
    },
  });

  // Create the main agent
  await prisma.agent.create({
    data: {
      userId: user.id,
      name: 'Atlas',
      role: 'Main AI Assistant',
      specialty: JSON.stringify(['general', 'orchestration', 'planning']),
      capabilities: JSON.stringify([
        'task_management',
        'team_coordination',
        'web_search',
        'code_execution',
        'file_management',
        'memory',
      ]),
      personality:
        'Helpful, proactive, and detail-oriented. You are Atlas, the main orchestrator.',
      isMainAgent: true,
      modelProvider: config.llm.provider,
      modelName: config.llm.defaultModel || undefined,
      stats: JSON.stringify({
        tasksCompleted: 0,
        messagesProcessed: 0,
        uptimeSeconds: 0,
        successRate: 100,
      }),
    },
  });

  // Create agent context
  const agents = await prisma.agent.findMany({ where: { userId: user.id } });
  for (const agent of agents) {
    await prisma.agentContext.create({
      data: {
        agentId: agent.id,
        conversationHistory: JSON.stringify([]),
        knowledgeBase: JSON.stringify({}),
        workingMemory: JSON.stringify({}),
      },
    });
  }

  console.log('[desktop] Default user and main agent created');
}

// ---------------------------------------------------------------------------
// IPC Handlers — bridge between renderer and main process
// ---------------------------------------------------------------------------

function registerIpcHandlers(): void {
  ipcMain.handle('get-config', () => {
    const config = loadConfig();
    // Return safe subset (no secrets)
    return {
      server: config.server,
      llm: {
        provider: config.llm.provider,
        ollamaBaseUrl: config.llm.ollamaBaseUrl,
        defaultModel: config.llm.defaultModel,
        hasAnthropicKey: !!config.llm.anthropicApiKey,
        hasOpenaiKey: !!config.llm.openaiApiKey,
      },
      appearance: config.appearance,
      dataDir: getDataDir(),
      dbPath: getDatabasePath(),
    };
  });

  ipcMain.handle('open-external', (_event, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle('show-notification', (_event, title: string, body: string) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isFocused()) {
      const notification = new Notification({ title, body });
      notification.on('click', () => {
        mainWindow.show();
        mainWindow.focus();
      });
      notification.show();
    } else {
      new Notification({ title, body }).show();
    }
  });

  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  // Dock badge count
  ipcMain.handle('set-badge-count', (_event, count: number) => {
    if (process.platform === 'darwin') {
      app.setBadgeCount(count);
    }
  });

  // Launch on login
  ipcMain.handle('set-launch-on-login', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    const config = loadConfig();
    config.appearance.launchOnLogin = enabled;
  });
}

// ---------------------------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  const firstRun = isFirstRun();
  ensureDataDir();

  const config = loadConfig();
  const port = config.server.port;

  registerIpcHandlers();

  try {
    await startServer(port);
  } catch (err) {
    console.error('[desktop] Failed to start server:', err);
    app.quit();
    return;
  }

  createMainWindow(port);

  if (!config.appearance.startMinimized) {
    getMainWindow()?.show();
  }

  createTray();

  // Auto-updater
  const mainWindow = getMainWindow();
  if (mainWindow) {
    setupAutoUpdater(mainWindow);
  }

  // Launch on login
  if (config.appearance.launchOnLogin) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  // Global keyboard shortcuts
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    const win = getMainWindow();
    if (win?.isVisible() && win?.isFocused()) {
      win.hide();
    } else {
      win?.show();
      win?.focus();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+N', () => {
    const win = getMainWindow();
    win?.show();
    win?.focus();
    win?.webContents.send('shortcut:new-chat');
  });

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(port);
    } else {
      getMainWindow()?.show();
    }
  });
});

// Prevent app from quitting when all windows are closed (runs in tray)
app.on('window-all-closed', () => {
  // On macOS, keep running in tray
  if (process.platform !== 'darwin') {
    // On Linux/Windows, minimize to tray as well
    // App only quits via tray menu "Quit"
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', async () => {
  destroyTray();
  destroyMainWindow();
  if (serverCleanup) {
    await serverCleanup();
  }
});
