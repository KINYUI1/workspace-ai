/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class TrelloAdapter implements IntegrationAdapter {
  slug = 'trello';

  private buildUrl(endpoint: string, credentials: Record<string, unknown>, extraParams: Record<string, string> = {}): string {
    const key = credentials.apiKey as string;
    const token = (credentials.apiToken || credentials.accessToken) as string;
    const params = new URLSearchParams({ key, token, ...extraParams });
    return `https://api.trello.com/1${endpoint}?${params}`;
  }

  async testConnection(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(this.buildUrl('/members/me', credentials));
      return res.ok;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (actionName) {
        case 'create_card':
          return await this.createCard(credentials, input);
        case 'move_card':
          return await this.moveCard(credentials, input);
        case 'list_boards':
          return await this.listBoards(credentials);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Trello action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async createCard(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const idList = input.listId as string;
    const name = input.name as string;
    if (!idList || !name) return { success: false, error: 'listId and name are required' };

    const params: Record<string, string> = { idList, name };
    if (input.desc) params.desc = input.desc as string;
    if (input.pos) params.pos = input.pos as string;

    const res = await fetch(this.buildUrl('/cards', credentials, params), { method: 'POST' });
    if (!res.ok) return { success: false, error: `Trello API error: ${res.status}` };
    const data = await res.json() as any;
    return { success: true, data: { id: data.id, name: data.name, url: data.url, shortUrl: data.shortUrl } };
  }

  private async moveCard(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const cardId = input.cardId as string;
    const listId = input.listId as string;
    if (!cardId || !listId) return { success: false, error: 'cardId and listId are required' };

    const res = await fetch(this.buildUrl(`/cards/${cardId}`, credentials, { idList: listId }), { method: 'PUT' });
    if (!res.ok) return { success: false, error: `Trello API error: ${res.status}` };
    const data = await res.json() as any;
    return { success: true, data: { id: data.id, name: data.name, idList: data.idList } };
  }

  private async listBoards(credentials: Record<string, unknown>): Promise<ActionResult> {
    const res = await fetch(this.buildUrl('/members/me/boards', credentials, { fields: 'name,url,desc,closed' }));
    if (!res.ok) return { success: false, error: `Trello API error: ${res.status}` };
    const data = await res.json() as any;
    return {
      success: true,
      data: data.filter((b: any) => !b.closed).map((b: any) => ({
        id: b.id,
        name: b.name,
        url: b.url,
        description: b.desc,
      })),
    };
  }
}
