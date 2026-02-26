/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class SlackAdapter implements IntegrationAdapter {
  slug = 'slack';

  private async slackFetch(
    endpoint: string,
    credentials: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = (credentials.accessToken || credentials.apiKey) as string;
    return fetch(`https://slack.com/api${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
        ...(options.headers as Record<string, string>),
      },
    });
  }

  async testConnection(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await this.slackFetch('/auth.test', credentials, { method: 'POST' });
      const data = await res.json() as any;
      return data.ok === true;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (actionName) {
        case 'send_message':
          return await this.sendMessage(credentials, input);
        case 'list_channels':
          return await this.listChannels(credentials, input);
        case 'create_channel':
          return await this.createChannel(credentials, input);
        case 'list_users':
          return await this.listUsers(credentials);
        case 'get_channel_history':
          return await this.getChannelHistory(credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Slack action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async sendMessage(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const channel = input.channel as string;
    const text = input.text as string;

    if (!channel || !text) {
      return { success: false, error: 'channel and text are required' };
    }

    const res = await this.slackFetch('/chat.postMessage', credentials, {
      method: 'POST',
      body: JSON.stringify({ channel, text }),
    });

    const data = await res.json() as any;
    if (!data.ok) return { success: false, error: data.error || 'Failed to send message' };

    return {
      success: true,
      data: {
        channel: data.channel,
        ts: data.ts,
        message: data.message?.text,
      },
    };
  }

  private async listChannels(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const limit = (input.limit as number) || 100;

    const res = await this.slackFetch(
      `/conversations.list?limit=${limit}&types=public_channel,private_channel`,
      credentials,
    );
    const data = await res.json() as any;
    if (!data.ok) return { success: false, error: data.error || 'Failed to list channels' };

    return {
      success: true,
      data: data.channels.map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        topic: (c.topic as Record<string, unknown>)?.value,
        memberCount: c.num_members,
        isPrivate: c.is_private,
      })),
    };
  }

  private async createChannel(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const name = input.name as string;
    if (!name) return { success: false, error: 'name is required' };

    const res = await this.slackFetch('/conversations.create', credentials, {
      method: 'POST',
      body: JSON.stringify({ name, is_private: input.isPrivate || false }),
    });

    const data = await res.json() as any;
    if (!data.ok) return { success: false, error: data.error || 'Failed to create channel' };

    return {
      success: true,
      data: { id: data.channel.id, name: data.channel.name },
    };
  }

  private async listUsers(credentials: Record<string, unknown>): Promise<ActionResult> {
    const res = await this.slackFetch('/users.list?limit=200', credentials);
    const data = await res.json() as any;
    if (!data.ok) return { success: false, error: data.error || 'Failed to list users' };

    return {
      success: true,
      data: data.members
        .filter((m: Record<string, unknown>) => !m.is_bot && !m.deleted)
        .map((m: Record<string, unknown>) => ({
          id: m.id,
          name: m.name,
          realName: m.real_name,
          email: (m.profile as Record<string, unknown>)?.email,
        })),
    };
  }

  private async getChannelHistory(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const channel = input.channel as string;
    const limit = (input.limit as number) || 20;
    if (!channel) return { success: false, error: 'channel is required' };

    const res = await this.slackFetch(
      `/conversations.history?channel=${channel}&limit=${limit}`,
      credentials,
    );
    const data = await res.json() as any;
    if (!data.ok) return { success: false, error: data.error || 'Failed to get history' };

    return {
      success: true,
      data: data.messages.map((m: Record<string, unknown>) => ({
        user: m.user,
        text: m.text,
        ts: m.ts,
        type: m.type,
      })),
    };
  }
}
