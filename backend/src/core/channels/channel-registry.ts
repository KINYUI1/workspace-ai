import { type ChannelType, type ChannelConfig, type Channel } from './channel-manager';
import { logger } from '../../utils/logger';

export interface ChannelAdapterFactory {
  type: ChannelType;
  displayName: string;
  description: string;
  icon: string;
  configSchema: ConfigField[];
  create(config: ChannelConfig): Channel;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'secret';
  required: boolean;
  placeholder?: string;
  description?: string;
}

class ChannelRegistry {
  private adapters: Map<ChannelType, ChannelAdapterFactory> = new Map();

  registerAdapter(adapter: ChannelAdapterFactory): void {
    this.adapters.set(adapter.type, adapter);
    logger.info(`Channel adapter registered: ${adapter.displayName} (${adapter.type})`);
  }

  getAdapter(type: ChannelType): ChannelAdapterFactory | undefined {
    return this.adapters.get(type);
  }

  getAvailableAdapters(): ChannelAdapterFactory[] {
    return Array.from(this.adapters.values());
  }

  createChannel(config: ChannelConfig): Channel {
    const adapter = this.adapters.get(config.type);
    if (!adapter) {
      throw new Error(`No adapter registered for channel type: ${config.type}`);
    }
    return adapter.create(config);
  }
}

export const channelRegistry = new ChannelRegistry();
