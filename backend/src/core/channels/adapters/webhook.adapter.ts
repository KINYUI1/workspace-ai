import { type Channel, type InboundMessage, type ChannelConfig, type ChannelType } from '../channel-manager';
import { type ChannelAdapterFactory } from '../channel-registry';
import { logger } from '../../../utils/logger';

class WebhookChannel implements Channel {
  id: string;
  type: ChannelType = 'webhook';
  name: string;
  status: 'connected' | 'disconnected' | 'error' = 'disconnected';
  config: Record<string, unknown>;

  private messageHandlers: Array<(msg: InboundMessage) => void> = [];

  constructor(channelConfig: ChannelConfig) {
    this.id = channelConfig.id;
    this.name = channelConfig.name;
    this.config = channelConfig.config;
  }

  async connect(): Promise<void> {
    this.status = 'connected';
    logger.info(`Webhook channel active: ${this.name}`);
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
  }

  async sendMessage(webhookUrl: string, content: string): Promise<void> {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, timestamp: new Date().toISOString() }),
    });
  }

  onMessage(handler: (msg: InboundMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Called by the webhook controller when an inbound webhook is received.
   */
  handleInboundWebhook(body: Record<string, unknown>): void {
    const msg: InboundMessage = {
      channelId: this.id,
      channelType: 'webhook',
      senderId: (body.senderId as string) || 'webhook',
      senderName: (body.senderName as string) || undefined,
      content: (body.content as string) || JSON.stringify(body),
      metadata: body,
      timestamp: new Date(),
    };

    for (const handler of this.messageHandlers) {
      handler(msg);
    }
  }

  getStatus(): { status: string; details?: string } {
    return { status: this.status };
  }
}

export const webhookAdapterFactory: ChannelAdapterFactory = {
  type: 'webhook',
  displayName: 'Webhook',
  description: 'Receive messages via HTTP webhooks and send responses',
  icon: 'webhook',
  configSchema: [
    { key: 'secret', label: 'Webhook Secret', type: 'secret', required: false, placeholder: 'Optional secret for request validation' },
    { key: 'responseUrl', label: 'Response URL', type: 'string', required: false, placeholder: 'URL to send responses to' },
  ],
  create: (config) => new WebhookChannel(config),
};
