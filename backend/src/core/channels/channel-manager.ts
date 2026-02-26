import { logger } from '../../utils/logger';

export interface InboundMessage {
  channelId: string;
  channelType: ChannelType;
  senderId: string;
  senderName?: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export type ChannelType = 'web' | 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'email' | 'webhook';

export interface ChannelConfig {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  agentId?: string; // Which agent handles messages from this channel
}

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  config: Record<string, unknown>;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(target: string, content: string): Promise<void>;
  onMessage(handler: (msg: InboundMessage) => void): void;
  getStatus(): { status: string; details?: string };
}

export type MessageHandler = (msg: InboundMessage) => Promise<void>;

class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private messageHandler: MessageHandler | null = null;

  setMessageHandler(handler: MessageHandler) {
    this.messageHandler = handler;
  }

  async addChannel(channel: Channel): Promise<void> {
    this.channels.set(channel.id, channel);

    // Wire up message handling
    channel.onMessage(async (msg) => {
      if (this.messageHandler) {
        try {
          await this.messageHandler(msg);
        } catch (err) {
          logger.error('Channel message handler error', {
            channelId: channel.id,
            error: (err as Error).message,
          });
        }
      }
    });

    logger.info(`Channel added: ${channel.name} (${channel.type})`);
  }

  async connectChannel(id: string): Promise<void> {
    const channel = this.channels.get(id);
    if (!channel) throw new Error(`Channel ${id} not found`);

    try {
      await channel.connect();
      logger.info(`Channel connected: ${channel.name}`);
    } catch (err) {
      logger.error(`Channel connection failed: ${channel.name}`, {
        error: (err as Error).message,
      });
      throw err;
    }
  }

  async disconnectChannel(id: string): Promise<void> {
    const channel = this.channels.get(id);
    if (!channel) return;

    await channel.disconnect();
    this.channels.delete(id);
    logger.info(`Channel disconnected: ${channel.name}`);
  }

  getChannel(id: string): Channel | undefined {
    return this.channels.get(id);
  }

  getAllChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  getChannelStatuses(): Array<{ id: string; name: string; type: ChannelType; status: string }> {
    return this.getAllChannels().map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      status: ch.getStatus().status,
    }));
  }

  async disconnectAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      try {
        await channel.disconnect();
      } catch {
        // best effort
      }
    }
    this.channels.clear();
  }
}

export const channelManager = new ChannelManager();
