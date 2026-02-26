/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class GoogleAnalyticsAdapter implements IntegrationAdapter {
  slug = 'google-analytics';

  private async gaFetch(
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
      const res = await this.gaFetch(
        'https://analyticsadmin.googleapis.com/v1beta/accounts',
        credentials,
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (actionName) {
        case 'get_report':
          return await this.getReport(credentials, input);
        case 'get_realtime':
          return await this.getRealtime(credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Google Analytics action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async getReport(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const propertyId = input.propertyId as string;
    if (!propertyId) return { success: false, error: 'propertyId is required (e.g. "properties/123456")' };

    const startDate = (input.startDate as string) || '30daysAgo';
    const endDate = (input.endDate as string) || 'today';
    const metrics = (input.metrics as string[]) || ['sessions', 'activeUsers'];
    const dimensions = (input.dimensions as string[]) || ['date'];

    const res = await this.gaFetch(
      `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
      credentials,
      {
        method: 'POST',
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: metrics.map((m) => ({ name: m })),
          dimensions: dimensions.map((d) => ({ name: d })),
        }),
      },
    );

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.error?.message || `Analytics API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return {
      success: true,
      data: {
        rowCount: data.rowCount,
        rows: (data.rows || []).map((r: any) => ({
          dimensions: r.dimensionValues?.map((d: any) => d.value),
          metrics: r.metricValues?.map((m: any) => m.value),
        })),
      },
    };
  }

  private async getRealtime(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const propertyId = input.propertyId as string;
    if (!propertyId) return { success: false, error: 'propertyId is required' };

    const metrics = (input.metrics as string[]) || ['activeUsers'];

    const res = await this.gaFetch(
      `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runRealtimeReport`,
      credentials,
      {
        method: 'POST',
        body: JSON.stringify({
          metrics: metrics.map((m) => ({ name: m })),
        }),
      },
    );

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.error?.message || `Analytics API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return {
      success: true,
      data: {
        rowCount: data.rowCount,
        rows: (data.rows || []).map((r: any) => ({
          dimensions: r.dimensionValues?.map((d: any) => d.value),
          metrics: r.metricValues?.map((m: any) => m.value),
        })),
      },
    };
  }
}
