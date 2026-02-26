import { channelRegistry } from './channel-registry';
import { telegramAdapterFactory } from './adapters/telegram.adapter';
import { discordAdapterFactory } from './adapters/discord.adapter';
import { slackAdapterFactory } from './adapters/slack.adapter';
import { webhookAdapterFactory } from './adapters/webhook.adapter';
import { emailAdapterFactory } from './adapters/email.adapter';

export function registerBuiltinChannelAdapters(): void {
  channelRegistry.registerAdapter(telegramAdapterFactory);
  channelRegistry.registerAdapter(discordAdapterFactory);
  channelRegistry.registerAdapter(slackAdapterFactory);
  channelRegistry.registerAdapter(webhookAdapterFactory);
  channelRegistry.registerAdapter(emailAdapterFactory);
}

export { channelManager } from './channel-manager';
export { channelRegistry } from './channel-registry';
