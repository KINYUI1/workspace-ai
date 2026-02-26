import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/async-handler';
import { pluginRegistry, type WorkspacePlugin } from '../../core/plugins/plugin-registry';
import { logger } from '../../utils/logger';

const router = Router();

const PLUGIN_DIR = path.join(process.env.HOME || '~', '.workspace-ai', 'plugins');

/**
 * GET /api/plugins
 * List all loaded plugins.
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const plugins = pluginRegistry.getPlugins().map((p) => ({
      name: p.name,
      version: p.version,
      description: p.description || '',
      kind: p.kind,
      enabled: p.enabled,
      toolCount: p.tools?.length ?? 0,
      hookCount: p.hooks?.length ?? 0,
      commandCount: p.commands?.length ?? 0,
      path: p.path,
    }));
    res.json({ data: plugins });
  }),
);

/**
 * POST /api/plugins/:name/enable
 */
router.post(
  '/:name/enable',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const success = pluginRegistry.enablePlugin(req.params.name);
    if (!success) {
      res.status(404).json({ error: 'Plugin not found' });
      return;
    }
    res.json({ ok: true });
  }),
);

/**
 * POST /api/plugins/:name/disable
 */
router.post(
  '/:name/disable',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const success = pluginRegistry.disablePlugin(req.params.name);
    if (!success) {
      res.status(404).json({ error: 'Plugin not found' });
      return;
    }
    res.json({ ok: true });
  }),
);

/**
 * POST /api/plugins/install
 * Install a plugin from a local directory path.
 */
router.post(
  '/install',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { path: pluginPath } = req.body;
    if (!pluginPath || typeof pluginPath !== 'string') {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    const resolvedPath = pluginPath.replace(/^~/, process.env.HOME || '~');

    if (!fs.existsSync(resolvedPath)) {
      res.status(400).json({ error: `Directory not found: ${pluginPath}` });
      return;
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'Path must be a directory' });
      return;
    }

    const indexPath = path.join(resolvedPath, 'index.js');
    if (!fs.existsSync(indexPath)) {
      res.status(400).json({ error: 'Plugin directory must contain an index.js file' });
      return;
    }

    // Symlink into plugins dir if not already there
    const pluginName = path.basename(resolvedPath);
    const targetPath = path.join(PLUGIN_DIR, pluginName);

    if (!fs.existsSync(PLUGIN_DIR)) {
      fs.mkdirSync(PLUGIN_DIR, { recursive: true });
    }

    if (resolvedPath !== targetPath && !fs.existsSync(targetPath)) {
      fs.symlinkSync(resolvedPath, targetPath, 'dir');
    }

    // Load the plugin
    try {
      let metadata: Partial<WorkspacePlugin> = {};
      const packagePath = path.join(resolvedPath, 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        metadata = { name: pkg.name || pluginName, version: pkg.version || '0.0.0', description: pkg.description };
      }

      const mod = require(indexPath);
      const plugin: WorkspacePlugin = {
        name: metadata.name || pluginName,
        version: metadata.version || '0.0.0',
        description: metadata.description || '',
        kind: mod.kind || 'tool',
        tools: mod.tools || [],
        hooks: mod.hooks || [],
        commands: mod.commands || [],
        onLoad: mod.onLoad,
        onUnload: mod.onUnload,
        enabled: true,
        path: resolvedPath,
      };

      await pluginRegistry.registerPlugin(plugin);
      logger.info(`Plugin installed: ${plugin.name}`, { path: resolvedPath });

      res.status(201).json({
        data: {
          name: plugin.name,
          version: plugin.version,
          description: plugin.description,
          kind: plugin.kind,
          enabled: plugin.enabled,
          toolCount: plugin.tools?.length ?? 0,
          hookCount: plugin.hooks?.length ?? 0,
          commandCount: plugin.commands?.length ?? 0,
          path: plugin.path,
        },
      });
    } catch (err) {
      res.status(500).json({ error: `Failed to load plugin: ${(err as Error).message}` });
    }
  }),
);

/**
 * POST /api/plugins/create
 * Scaffold a new plugin with a starter template.
 */
router.post(
  '/create',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, kind = 'tool', description = '' } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const pluginPath = path.join(PLUGIN_DIR, safeName);

    if (fs.existsSync(pluginPath)) {
      res.status(409).json({ error: `Plugin "${safeName}" already exists` });
      return;
    }

    // Create directory structure
    fs.mkdirSync(pluginPath, { recursive: true });

    // Write package.json
    const packageJson = {
      name: safeName,
      version: '1.0.0',
      description: description || `${safeName} plugin for Workspace AI`,
      main: 'index.js',
    };
    fs.writeFileSync(path.join(pluginPath, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Write starter index.js based on kind
    const indexContent = kind === 'hook'
      ? `// ${safeName} - Hook Plugin
// This plugin runs hooks at various points in the agent lifecycle.

module.exports = {
  kind: 'hook',

  hooks: [
    {
      entry: 'before-agent-start',
      priority: 100,
      handler: async (context) => {
        console.log('[${safeName}] Agent starting:', context.agentName || 'unknown');
        // Return modified context, or void to pass through
        return context;
      },
    },
  ],

  // Optional lifecycle
  onLoad: async (ctx) => {
    ctx.logger.info('${safeName} plugin loaded');
  },
};
`
      : `// ${safeName} - Tool Plugin
// This plugin adds custom tools that agents can use.

module.exports = {
  kind: 'tool',

  tools: [
    {
      name: '${safeName}_example',
      description: '${description || 'An example tool - replace with your own logic'}',
      input_schema: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Input for the tool',
          },
        },
        required: ['input'],
      },
      execute: async (params) => {
        // TODO: Implement your tool logic here
        return { result: 'Hello from ${safeName}!', input: params.input };
      },
    },
  ],

  // Optional lifecycle
  onLoad: async (ctx) => {
    ctx.logger.info('${safeName} plugin loaded');
  },
};
`;

    fs.writeFileSync(path.join(pluginPath, 'index.js'), indexContent);

    // Load it immediately
    try {
      const mod = require(path.join(pluginPath, 'index.js'));
      const plugin: WorkspacePlugin = {
        name: safeName,
        version: '1.0.0',
        description: description || `${safeName} plugin for Workspace AI`,
        kind: mod.kind || 'tool',
        tools: mod.tools || [],
        hooks: mod.hooks || [],
        commands: mod.commands || [],
        onLoad: mod.onLoad,
        onUnload: mod.onUnload,
        enabled: true,
        path: pluginPath,
      };

      await pluginRegistry.registerPlugin(plugin);
      logger.info(`Plugin created and loaded: ${safeName}`, { path: pluginPath });

      res.status(201).json({
        data: {
          name: plugin.name,
          version: plugin.version,
          description: plugin.description,
          kind: plugin.kind,
          enabled: plugin.enabled,
          toolCount: plugin.tools?.length ?? 0,
          hookCount: plugin.hooks?.length ?? 0,
          commandCount: plugin.commands?.length ?? 0,
          path: plugin.path,
        },
      });
    } catch (err) {
      res.status(500).json({ error: `Plugin created but failed to load: ${(err as Error).message}` });
    }
  }),
);

export { router as pluginRouter };
