import { type Channel, type InboundMessage, type ChannelConfig, type ChannelType } from '../channel-manager';
import { type ChannelAdapterFactory } from '../channel-registry';
import { logger } from '../../../utils/logger';

class SlackChannel implements Channel {
  id: string;
  type: ChannelType = 'slack';
  name: string;
  status: 'connected' | 'disconnected' | 'error' = 'disconnected';
  config: Record<string, unknown>;

  private messageHandlers: Array<(msg: InboundMessage) => void> = [];
  private botToken: string;

  constructor(channelConfig: ChannelConfig) {
    this.id = channelConfig.id;
    this.name = channelConfig.name;
    this.config = channelConfig.config;
    this.botToken = (channelConfig.config.botToken as string) || '';
  }

  async connect(): Promise<void> {
    if (!this.botToken) {
      this.status = 'error';
      throw new Error('Slack bot token is required');
    }

    try {
      const res = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.botToken}` },
      });

      const data = (await res.json()) as { ok: boolean; error?: string; user: string; team: string };
      if (!data.ok) {
        this.status = 'error';
        throw new Error(`Slack auth failed: ${data.error}`);
      }

      this.status = 'connected';
      logger.info(`Slack bot connected: ${data.user} in ${data.team}`);
    } catch (err) {
      this.status = 'error';
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
  }

  async sendMessage(channel: string, content: string): Promise<void> {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.botToken}`,
      },
      body: JSON.stringify({ channel, text: content }),
    });
  }

  onMessage(handler: (msg: InboundMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  getStatus(): { status: string; details?: string } {
    return { status: this.status };
  }
}

export const slackAdapterFactory: ChannelAdapterFactory = {
  type: 'slack',
  displayName: 'Slack',
  description: 'Connect a Slack bot to receive and send messages',
  icon: 'slack',
  configSchema: [
    { key: 'botToken', label: 'Bot OAuth Token', type: 'secret', required: true, placeholder: 'xoxb-...', description: 'Bot User OAuth Token from Slack App settings' },
  ],
  create: (config) => new SlackChannel(config),
};
