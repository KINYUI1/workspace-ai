import { type Channel, type InboundMessage, type ChannelConfig, type ChannelType } from '../channel-manager';
import { type ChannelAdapterFactory } from '../channel-registry';
import { logger } from '../../../utils/logger';

class EmailChannel implements Channel {
  id: string;
  type: ChannelType = 'email';
  name: string;
  status: 'connected' | 'disconnected' | 'error' = 'disconnected';
  config: Record<string, unknown>;

  private messageHandlers: Array<(msg: InboundMessage) => void> = [];
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(channelConfig: ChannelConfig) {
    this.id = channelConfig.id;
    this.name = channelConfig.name;
    this.config = channelConfig.config;
  }

  async connect(): Promise<void> {
    const { imapHost, imapPort, smtpHost, email, password } = this.config as Record<string, string>;

    if (!email || !password) {
      this.status = 'error';
      throw new Error('Email credentials are required');
    }

    // Note: Full IMAP/SMTP integration would use nodemailer + imap-simple
    // This is a placeholder adapter showing the interface
    this.status = 'connected';
    logger.info(`Email channel connected: ${email}`);
  }

  async disconnect(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.status = 'disconnected';
  }

  async sendMessage(toEmail: string, content: string): Promise<void> {
    // Placeholder: would use nodemailer SMTP transport
    logger.info(`Email send (placeholder): to=${toEmail}, content length=${content.length}`);
  }

  onMessage(handler: (msg: InboundMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  getStatus(): { status: string; details?: string } {
    return { status: this.status, details: this.status === 'connected' ? `${this.config.email}` : undefined };
  }
}

export const emailAdapterFactory: ChannelAdapterFactory = {
  type: 'email',
  displayName: 'Email',
  description: 'Send and receive emails via IMAP/SMTP',
  icon: 'email',
  configSchema: [
    { key: 'email', label: 'Email Address', type: 'string', required: true, placeholder: 'bot@example.com' },
    { key: 'password', label: 'Password', type: 'secret', required: true },
    { key: 'imapHost', label: 'IMAP Host', type: 'string', required: true, placeholder: 'imap.gmail.com' },
    { key: 'imapPort', label: 'IMAP Port', type: 'number', required: false, placeholder: '993' },
    { key: 'smtpHost', label: 'SMTP Host', type: 'string', required: true, placeholder: 'smtp.gmail.com' },
    { key: 'smtpPort', label: 'SMTP Port', type: 'number', required: false, placeholder: '587' },
  ],
  create: (config) => new EmailChannel(config),
};
