/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class MicrosoftTeamsAdapter implements IntegrationAdapter {
  slug = 'microsoft-teams';

  private async graphFetch(
    endpoint: string,
    credentials: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = credentials.accessToken as string;
    return fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });
  }

  async testConnection(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await this.graphFetch('/me', credentials);
      return res.ok;
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
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Microsoft Teams action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async sendMessage(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const teamId = input.teamId as string;
    const channelId = input.channelId as string;
    const content = input.content as string;
    if (!teamId || !channelId || !content) return { success: false, error: 'teamId, channelId, and content are required' };

    const res = await this.graphFetch(`/teams/${teamId}/channels/${channelId}/messages`, credentials, {
      method: 'POST',
      body: JSON.stringify({
        body: { contentType: 'text', content },
      }),
    });

    if (!res.ok) return { success: false, error: `Graph API error: ${res.status}` };
    const data = await res.json() as any;
    return { success: true, data: { id: data.id, createdDateTime: data.createdDateTime } };
  }

  private async listChannels(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const teamId = input.teamId as string;
    if (!teamId) return { success: false, error: 'teamId is required' };

    const res = await this.graphFetch(`/teams/${teamId}/channels`, credentials);
    if (!res.ok) return { success: false, error: `Graph API error: ${res.status}` };
    const data = await res.json() as any;
    return {
      success: true,
      data: (data.value || []).map((c: any) => ({
        id: c.id,
        displayName: c.displayName,
        description: c.description,
        membershipType: c.membershipType,
      })),
    };
  }
}
