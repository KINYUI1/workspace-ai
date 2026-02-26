import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { pluginRegistry, type WorkspacePlugin, type PluginContext } from './plugin-registry';

const PLUGIN_DIRS = [
  path.join(process.env.HOME || '~', '.workspace-ai', 'plugins'),
  path.join(process.cwd(), 'plugins'),
];

/**
 * Discovers and loads plugins from known directories.
 */
export async function loadPlugins(): Promise<void> {
  for (const dir of PLUGIN_DIRS) {
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginPath = path.join(dir, entry.name);
      const indexPath = path.join(pluginPath, 'index.js');
      const packagePath = path.join(pluginPath, 'package.json');

      if (!fs.existsSync(indexPath)) continue;

      try {
        // Read package.json for metadata if it exists
        let metadata: Partial<WorkspacePlugin> = {};
        if (fs.existsSync(packagePath)) {
          const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
          metadata = {
            name: pkg.name || entry.name,
            version: pkg.version || '0.0.0',
            description: pkg.description,
          };
        }

        // Load the plugin module
        const mod = require(indexPath);
        const plugin: WorkspacePlugin = {
          name: metadata.name || entry.name,
          version: metadata.version || '0.0.0',
          description: metadata.description || '',
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
        logger.info(`Plugin loaded: ${plugin.name}@${plugin.version}`, { pluginPath });
      } catch (err) {
        logger.error(`Failed to load plugin: ${entry.name}`, { error: (err as Error).message, pluginPath });
      }
    }
  }

  logger.info(`Plugin loading complete. ${pluginRegistry.getPlugins().length} plugin(s) loaded.`);
}

/**
 * Unloads all plugins (for shutdown).
 */
export async function unloadPlugins(): Promise<void> {
  const plugins = pluginRegistry.getPlugins();
  for (const plugin of plugins) {
    await pluginRegistry.unregisterPlugin(plugin.name);
  }
  logger.info('All plugins unloaded.');
}
