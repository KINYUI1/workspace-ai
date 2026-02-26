import { type Channel, type InboundMessage, type ChannelConfig, type ChannelType } from '../channel-manager';
import { type ChannelAdapterFactory, type ConfigField } from '../channel-registry';
import { logger } from '../../../utils/logger';

class TelegramChannel implements Channel {
  id: string;
  type: ChannelType = 'telegram';
  name: string;
  status: 'connected' | 'disconnected' | 'error' = 'disconnected';
  config: Record<string, unknown>;

  private messageHandlers: Array<(msg: InboundMessage) => void> = [];
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
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
      throw new Error('Telegram bot token is required');
    }

    try {
      // Verify bot token by calling getMe
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
      const data = (await res.json()) as { ok: boolean; description?: string; result: { username: string } };

      if (!data.ok) {
        this.status = 'error';
        throw new Error(`Telegram API error: ${data.description}`);
      }

      this.status = 'connected';
      logger.info(`Telegram bot connected: @${data.result.username}`);

      // Start polling for updates
      this.startPolling();
    } catch (err) {
      this.status = 'error';
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.status = 'disconnected';
  }

  async sendMessage(chatId: string, content: string): Promise<void> {
    await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: content, parse_mode: 'Markdown' }),
    });
  }

  onMessage(handler: (msg: InboundMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  getStatus(): { status: string; details?: string } {
    return { status: this.status };
  }

  private lastUpdateId = 0;

  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=1`
        );
        const data = (await res.json()) as { ok: boolean; result: any[] };

        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            this.lastUpdateId = update.update_id;

            if (update.message?.text) {
              const msg: InboundMessage = {
                channelId: this.id,
                channelType: 'telegram',
                senderId: String(update.message.from.id),
                senderName: update.message.from.first_name,
                content: update.message.text,
                metadata: { chatId: String(update.message.chat.id) },
                timestamp: new Date(update.message.date * 1000),
              };

              for (const handler of this.messageHandlers) {
                handler(msg);
              }
            }
          }
        }
      } catch (err) {
        logger.error('Telegram polling error', { error: (err as Error).message });
      }
    }, 3000);
  }
}

export const telegramAdapterFactory: ChannelAdapterFactory = {
  type: 'telegram',
  displayName: 'Telegram',
  description: 'Connect a Telegram bot to receive and send messages',
  icon: 'telegram',
  configSchema: [
    { key: 'botToken', label: 'Bot Token', type: 'secret', required: true, placeholder: '123456:ABC-DEF...', description: 'Get from @BotFather on Telegram' },
  ],
  create: (config) => new TelegramChannel(config),
};
