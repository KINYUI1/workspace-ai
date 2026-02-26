/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class NotionAdapter implements IntegrationAdapter {
  slug = 'notion';

  private async notionFetch(
    endpoint: string,
    credentials: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = (credentials.accessToken || credentials.apiKey) as string;
    return fetch(`https://api.notion.com/v1${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        ...(options.headers as Record<string, string>),
      },
    });
  }

  async testConnection(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await this.notionFetch('/users/me', credentials);
      return res.ok;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (actionName) {
        case 'create_page':
          return await this.createPage(credentials, input);
        case 'query_database':
          return await this.queryDatabase(credentials, input);
        case 'update_page':
          return await this.updatePage(credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Notion action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async createPage(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const parentId = input.parentId as string;
    const title = input.title as string;
    if (!parentId || !title) return { success: false, error: 'parentId and title are required' };

    const isDatabase = (input.parentType as string) === 'database';
    const parent = isDatabase
      ? { database_id: parentId }
      : { page_id: parentId };

    const properties: any = isDatabase
      ? { Name: { title: [{ text: { content: title } }] } }
      : { title: { title: [{ text: { content: title } }] } };

    const body: any = { parent, properties };
    if (input.content) {
      body.children = [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: input.content as string } }] },
        },
      ];
    }

    const res = await this.notionFetch('/pages', credentials, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.message || `Notion API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return { success: true, data: { id: data.id, url: data.url } };
  }

  private async queryDatabase(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const databaseId = input.databaseId as string;
    if (!databaseId) return { success: false, error: 'databaseId is required' };

    const body: any = {};
    if (input.filter) body.filter = input.filter;
    if (input.sorts) body.sorts = input.sorts;
    body.page_size = (input.pageSize as number) || 20;

    const res = await this.notionFetch(`/databases/${databaseId}/query`, credentials, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.message || `Notion API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return {
      success: true,
      data: {
        results: data.results.map((r: any) => ({
          id: r.id,
          url: r.url,
          properties: r.properties,
        })),
        hasMore: data.has_more,
        nextCursor: data.next_cursor,
      },
    };
  }

  private async updatePage(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const pageId = input.pageId as string;
    if (!pageId) return { success: false, error: 'pageId is required' };

    const body: any = {};
    if (input.properties) body.properties = input.properties;
    if (input.archived !== undefined) body.archived = input.archived;

    const res = await this.notionFetch(`/pages/${pageId}`, credentials, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.message || `Notion API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return { success: true, data: { id: data.id, url: data.url } };
  }
}
