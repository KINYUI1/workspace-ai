import { logger } from '../../utils/logger';

export interface AgentToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface HookRegistration {
  entry: HookEntry;
  priority?: number;
  handler: (context: Record<string, unknown>) => Promise<Record<string, unknown> | void>;
}

export interface CommandDefinition {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<string>;
}

export type HookEntry =
  | 'before-agent-start'
  | 'after-agent-complete'
  | 'on-tool-call'
  | 'on-message-received'
  | 'on-message-send'
  | 'on-config-change';

export interface PluginContext {
  logger: typeof logger;
  config: Record<string, unknown>;
}

export interface WorkspacePlugin {
  name: string;
  version: string;
  description?: string;
  kind: 'tool' | 'channel' | 'memory' | 'hook';

  tools?: AgentToolDefinition[];
  hooks?: HookRegistration[];
  commands?: CommandDefinition[];

  onLoad?: (context: PluginContext) => Promise<void>;
  onUnload?: () => Promise<void>;

  enabled: boolean;
  path?: string;
}

class PluginRegistry {
  private plugins: Map<string, WorkspacePlugin> = new Map();

  async registerPlugin(plugin: WorkspacePlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      logger.warn(`Plugin "${plugin.name}" is already registered. Skipping.`);
      return;
    }

    // Run onLoad lifecycle hook
    if (plugin.onLoad) {
      const context: PluginContext = {
        logger,
        config: {},
      };
      await plugin.onLoad(context);
    }

    this.plugins.set(plugin.name, plugin);
    logger.info(`Plugin registered: ${plugin.name}@${plugin.version}`);
  }

  async unregisterPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) return;

    if (plugin.onUnload) {
      await plugin.onUnload();
    }

    this.plugins.delete(name);
    logger.info(`Plugin unregistered: ${name}`);
  }

  getPlugin(name: string): WorkspacePlugin | undefined {
    return this.plugins.get(name);
  }

  getPlugins(): WorkspacePlugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): WorkspacePlugin[] {
    return this.getPlugins().filter(p => p.enabled);
  }

  enablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    plugin.enabled = true;
    return true;
  }

  disablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    plugin.enabled = false;
    return true;
  }

  /**
   * Get all tools provided by enabled plugins.
   */
  getPluginTools(): AgentToolDefinition[] {
    const tools: AgentToolDefinition[] = [];
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.tools) {
        tools.push(...plugin.tools);
      }
    }
    return tools;
  }

  /**
   * Get all hooks for a specific entry point, sorted by priority.
   */
  getHooks(entry: HookEntry): HookRegistration[] {
    const hooks: HookRegistration[] = [];
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks) {
        hooks.push(...plugin.hooks.filter(h => h.entry === entry));
      }
    }
    return hooks.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }
}

export const pluginRegistry = new PluginRegistry();
