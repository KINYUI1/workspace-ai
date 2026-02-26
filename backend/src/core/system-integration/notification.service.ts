import { logger } from '../../utils/logger';

interface UserSettings {
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
  [key: string]: unknown;
}

interface NotifyResult {
  sent: string[];
  failed: string[];
}

export class NotificationService {
  async sendSlack(webhookUrl: string, message: string): Promise<void> {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    if (!res.ok) {
      throw new Error(`Slack webhook failed: ${res.status}`);
    }
  }

  async sendDiscord(webhookUrl: string, message: string): Promise<void> {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
    if (!res.ok) {
      throw new Error(`Discord webhook failed: ${res.status}`);
    }
  }

  async notify(
    userSettings: UserSettings,
    message: string,
    channel: string = 'all',
  ): Promise<NotifyResult> {
    const sent: string[] = [];
    const failed: string[] = [];

    const shouldSendSlack = (channel === 'slack' || channel === 'all') && userSettings.slackWebhookUrl;
    const shouldSendDiscord = (channel === 'discord' || channel === 'all') && userSettings.discordWebhookUrl;

    if (shouldSendSlack) {
      try {
        await this.sendSlack(userSettings.slackWebhookUrl!, message);
        sent.push('slack');
      } catch (error) {
        logger.error('Slack notification failed', { error: (error as Error).message });
        failed.push('slack');
      }
    }

    if (shouldSendDiscord) {
      try {
        await this.sendDiscord(userSettings.discordWebhookUrl!, message);
        sent.push('discord');
      } catch (error) {
        logger.error('Discord notification failed', { error: (error as Error).message });
        failed.push('discord');
      }
    }

    if (sent.length === 0 && failed.length === 0) {
      return { sent: [], failed: [], };
    }

    return { sent, failed };
  }
}
