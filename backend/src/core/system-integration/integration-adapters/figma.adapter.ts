/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class FigmaAdapter implements IntegrationAdapter {
  slug = 'figma';

  private async figmaFetch(
    endpoint: string,
    credentials: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = (credentials.accessToken || credentials.apiKey) as string;
    return fetch(`https://api.figma.com/v1${endpoint}`, {
      ...options,
      headers: {
        'X-Figma-Token': token,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });
  }

  async testConnection(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await this.figmaFetch('/me', credentials);
      return res.ok;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (actionName) {
        case 'get_file':
          return await this.getFile(credentials, input);
        case 'export_assets':
          return await this.exportAssets(credentials, input);
        case 'list_projects':
          return await this.listProjects(credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Figma action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async getFile(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const fileKey = input.fileKey as string;
    if (!fileKey) return { success: false, error: 'fileKey is required' };

    const res = await this.figmaFetch(`/files/${fileKey}?depth=1`, credentials);
    if (!res.ok) return { success: false, error: `Figma API error: ${res.status}` };
    const data = await res.json() as any;
    return {
      success: true,
      data: {
        name: data.name,
        lastModified: data.lastModified,
        version: data.version,
        thumbnailUrl: data.thumbnailUrl,
        pages: data.document?.children?.map((p: any) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          childCount: p.children?.length || 0,
        })),
      },
    };
  }

  private async exportAssets(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const fileKey = input.fileKey as string;
    const nodeIds = input.nodeIds as string;
    if (!fileKey || !nodeIds) return { success: false, error: 'fileKey and nodeIds are required' };

    const format = (input.format as string) || 'png';
    const scale = (input.scale as number) || 2;

    const res = await this.figmaFetch(
      `/images/${fileKey}?ids=${encodeURIComponent(nodeIds)}&format=${format}&scale=${scale}`,
      credentials,
    );
    if (!res.ok) return { success: false, error: `Figma API error: ${res.status}` };
    const data = await res.json() as any;
    return {
      success: true,
      data: {
        images: data.images,
        err: data.err,
      },
    };
  }

  private async listProjects(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const teamId = input.teamId as string;
    if (!teamId) return { success: false, error: 'teamId is required' };

    const res = await this.figmaFetch(`/teams/${teamId}/projects`, credentials);
    if (!res.ok) return { success: false, error: `Figma API error: ${res.status}` };
    const data = await res.json() as any;
    return {
      success: true,
      data: (data.projects || []).map((p: any) => ({
        id: p.id,
        name: p.name,
      })),
    };
  }
}
