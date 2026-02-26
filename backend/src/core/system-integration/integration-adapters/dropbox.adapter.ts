/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class DropboxAdapter implements IntegrationAdapter {
  slug = 'dropbox';

  private async dropboxFetch(
    url: string,
    credentials: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = credentials.accessToken as string;
    return fetch(url, {
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
      const res = await this.dropboxFetch(
        'https://api.dropboxapi.com/2/users/get_current_account',
        credentials,
        { method: 'POST' },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (actionName) {
        case 'list_files':
          return await this.listFiles(credentials, input);
        case 'upload_file':
          return await this.uploadFile(credentials, input);
        case 'download_file':
          return await this.downloadFile(credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Dropbox action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async listFiles(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const path = (input.path as string) || '';
    const limit = (input.limit as number) || 25;

    const res = await this.dropboxFetch(
      'https://api.dropboxapi.com/2/files/list_folder',
      credentials,
      {
        method: 'POST',
        body: JSON.stringify({ path, limit, include_media_info: false }),
      },
    );

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.error_summary || `Dropbox API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return {
      success: true,
      data: (data.entries || []).map((e: any) => ({
        name: e.name,
        pathDisplay: e.path_display,
        tag: e['.tag'],
        size: e.size,
        serverModified: e.server_modified,
        id: e.id,
      })),
    };
  }

  private async uploadFile(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const path = input.path as string;
    const content = input.content as string;
    if (!path || !content) return { success: false, error: 'path and content are required' };

    const token = credentials.accessToken as string;
    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: 'overwrite',
          autorename: true,
        }),
      },
      body: content,
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.error_summary || `Dropbox API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return { success: true, data: { name: data.name, pathDisplay: data.path_display, size: data.size, id: data.id } };
  }

  private async downloadFile(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const path = input.path as string;
    if (!path) return { success: false, error: 'path is required' };

    const token = credentials.accessToken as string;
    const res = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path }),
      },
    });

    if (!res.ok) return { success: false, error: `Dropbox API error: ${res.status}` };
    const metadata = JSON.parse(res.headers.get('dropbox-api-result') || '{}');
    const text = await res.text();
    return {
      success: true,
      data: {
        name: metadata.name,
        path: metadata.path_display,
        size: metadata.size,
        content: text.length > 10000 ? text.slice(0, 10000) + '... (truncated)' : text,
      },
    };
  }
}
