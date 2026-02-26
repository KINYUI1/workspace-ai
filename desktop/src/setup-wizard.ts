import { BrowserWindow } from 'electron';
import { loadConfig, saveConfig, type DesktopConfig } from './config';

// ---------------------------------------------------------------------------
// First-Run Setup Wizard
// Opens a small window to collect API keys before the main app starts.
// ---------------------------------------------------------------------------

/**
 * Show the setup wizard and wait for the user to submit API keys.
 * Returns the updated config.
 */
export function showSetupWizard(): Promise<DesktopConfig> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 480,
      resizable: false,
      title: 'Workspace AI — Setup',
      backgroundColor: '#0f172a',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Generate a simple HTML form inline
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a; color: #e2e8f0;
      padding: 32px; display: flex; flex-direction: column; height: 100vh;
    }
    h1 { font-size: 22px; margin-bottom: 8px; }
    p { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1; }
    input {
      width: 100%; padding: 10px 12px; background: #1e293b; border: 1px solid #334155;
      border-radius: 6px; color: #e2e8f0; font-size: 14px; margin-bottom: 16px; outline: none;
    }
    input:focus { border-color: #6366f1; }
    .hint { font-size: 11px; color: #64748b; margin-top: -12px; margin-bottom: 16px; }
    button {
      width: 100%; padding: 12px; background: #6366f1; color: white; border: none;
      border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: auto;
    }
    button:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <h1>Welcome to Workspace AI</h1>
  <p>Enter your API key to get started. You can change this later in Settings.</p>

  <label for="anthropic">Anthropic API Key</label>
  <input type="password" id="anthropic" placeholder="sk-ant-..." />
  <div class="hint">Required for Claude-powered agents</div>

  <label for="name">Your Name</label>
  <input type="text" id="name" placeholder="Local User" value="Local User" />

  <button onclick="submit()">Get Started</button>

  <script>
    function submit() {
      const anthropicKey = document.getElementById('anthropic').value.trim();
      const name = document.getElementById('name').value.trim() || 'Local User';

      // Post the data back to the main process via a custom protocol
      fetch('http://localhost:__PORT__/api/desktop/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicKey, name }),
      }).then(() => {
        window.close();
      }).catch(() => {
        // Fallback: close anyway
        window.close();
      });
    }
  </script>
</body>
</html>`;

    const config = loadConfig();
    const finalHtml = html.replace('__PORT__', String(config.server.port));
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(finalHtml)}`);

    win.on('closed', () => {
      resolve(loadConfig());
    });
  });
}
