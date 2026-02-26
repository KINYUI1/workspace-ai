import { pluginRegistry, type HookEntry } from './plugin-registry';
import { logger } from '../../utils/logger';

/**
 * Execute hooks for a given entry point.
 * Hooks run in priority order. For "waterfall" hooks (on-message-received, on-message-send),
 * each hook can modify the context and pass it to the next.
 */
export async function executeHooks(
  entry: HookEntry,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const hooks = pluginRegistry.getHooks(entry);

  if (hooks.length === 0) return context;

  let currentContext = { ...context };

  for (const hook of hooks) {
    try {
      const result = await hook.handler(currentContext);
      if (result) {
        currentContext = { ...currentContext, ...result };
      }
    } catch (err) {
      logger.error(`Hook execution failed for entry "${entry}"`, {
        error: (err as Error).message,
      });
    }
  }

  return currentContext;
}

/**
 * Execute hooks that can block/cancel an action.
 * Returns true if the action should proceed, false if blocked.
 */
export async function executeGateHooks(
  entry: HookEntry,
  context: Record<string, unknown>,
): Promise<{ proceed: boolean; context: Record<string, unknown> }> {
  const hooks = pluginRegistry.getHooks(entry);

  let currentContext = { ...context };

  for (const hook of hooks) {
    try {
      const result = await hook.handler(currentContext);
      if (result) {
        if (result.blocked === true) {
          return { proceed: false, context: currentContext };
        }
        currentContext = { ...currentContext, ...result };
      }
    } catch (err) {
      logger.error(`Gate hook execution failed for entry "${entry}"`, {
        error: (err as Error).message,
      });
    }
  }

  return { proceed: true, context: currentContext };
}
