import { type Channel, type InboundMessage, type ChannelConfig, type ChannelType } from '../channel-manager';
import { type ChannelAdapterFactory } from '../channel-registry';
import { logger } from '../../../utils/logger';

class DiscordChannel implements Channel {
  id: string;
  type: ChannelType = 'discord';
  name: string;
  status: 'connected' | 'disconnected' | 'error' = 'disconnected';
  config: Record<string, unknown>;

  private messageHandlers: Array<(msg: InboundMessage) => void> = [];
  private ws: any = null;
  private botToken: string;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(channelConfig: ChannelConfig) {
    this.id = channelConfig.id;
    this.name = channelConfig.name;
    this.config = channelConfig.config;
    this.botToken = (channelConfig.config.botToken as string) || '';
  }

  async connect(): Promise<void> {
    if (!this.botToken) {
      this.status = 'error';
      throw new Error('Discord bot token is required');
    }

    try {
      // Verify token via REST API
      const res = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${this.botToken}` },
      });

      if (!res.ok) {
        this.status = 'error';
        throw new Error('Invalid Discord bot token');
      }

      const bot = (await res.json()) as { username: string; discriminator: string };
      this.status = 'connected';
      logger.info(`Discord bot connected: ${bot.username}#${bot.discriminator}`);

      // Note: Full WebSocket Gateway integration would require discord.js
      // This is a simplified REST-only adapter
    } catch (err) {
      this.status = 'error';
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.status = 'disconnected';
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${this.botToken}`,
      },
      body: JSON.stringify({ content }),
    });
  }

  onMessage(handler: (msg: InboundMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  getStatus(): { status: string; details?: string } {
    return { status: this.status };
  }
}

export const discordAdapterFactory: ChannelAdapterFactory = {
  type: 'discord',
  displayName: 'Discord',
  description: 'Connect a Discord bot to receive and send messages',
  icon: 'discord',
  configSchema: [
    { key: 'botToken', label: 'Bot Token', type: 'secret', required: true, placeholder: 'Your Discord bot token', description: 'Get from Discord Developer Portal' },
  ],
  create: (config) => new DiscordChannel(config),
};
