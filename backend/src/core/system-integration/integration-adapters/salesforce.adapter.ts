/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class SalesforceAdapter implements IntegrationAdapter {
  slug = 'salesforce';

  private async sfFetch(
    instanceUrl: string,
    endpoint: string,
    credentials: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = credentials.accessToken as string;
    return fetch(`${instanceUrl}/services/data/v59.0${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });
  }

  private getInstanceUrl(credentials: Record<string, unknown>): string {
    return ((credentials.instanceUrl as string) || '').replace(/\/$/, '');
  }

  async testConnection(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      const instanceUrl = this.getInstanceUrl(credentials);
      if (!instanceUrl) return false;
      const res = await this.sfFetch(instanceUrl, '/sobjects', credentials);
      return res.ok;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      const instanceUrl = this.getInstanceUrl(credentials);
      if (!instanceUrl) return { success: false, error: 'instanceUrl is required in credentials' };

      switch (actionName) {
        case 'create_lead':
          return await this.createLead(instanceUrl, credentials, input);
        case 'update_contact':
          return await this.updateContact(instanceUrl, credentials, input);
        case 'query_records':
          return await this.queryRecords(instanceUrl, credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Salesforce action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async createLead(instanceUrl: string, credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const lastName = input.lastName as string;
    const company = input.company as string;
    if (!lastName || !company) return { success: false, error: 'lastName and company are required' };

    const body: Record<string, unknown> = { LastName: lastName, Company: company };
    if (input.firstName) body.FirstName = input.firstName;
    if (input.email) body.Email = input.email;
    if (input.phone) body.Phone = input.phone;
    if (input.title) body.Title = input.title;

    const res = await this.sfFetch(instanceUrl, '/sobjects/Lead', credentials, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: Array.isArray(err) ? err[0]?.message : `Salesforce API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return { success: true, data: { id: data.id, success: data.success } };
  }

  private async updateContact(instanceUrl: string, credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const contactId = input.contactId as string;
    if (!contactId) return { success: false, error: 'contactId is required' };

    const body: Record<string, unknown> = {};
    if (input.firstName) body.FirstName = input.firstName;
    if (input.lastName) body.LastName = input.lastName;
    if (input.email) body.Email = input.email;
    if (input.phone) body.Phone = input.phone;
    if (input.title) body.Title = input.title;

    const res = await this.sfFetch(instanceUrl, `/sobjects/Contact/${contactId}`, credentials, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: Array.isArray(err) ? err[0]?.message : `Salesforce API error: ${res.status}` };
    }
    return { success: true, data: { contactId, updated: true } };
  }

  private async queryRecords(instanceUrl: string, credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const query = input.query as string;
    if (!query) return { success: false, error: 'SOQL query is required' };

    const res = await this.sfFetch(instanceUrl, `/query?q=${encodeURIComponent(query)}`, credentials);
    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: Array.isArray(err) ? err[0]?.message : `Salesforce API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return {
      success: true,
      data: {
        totalSize: data.totalSize,
        done: data.done,
        records: data.records,
      },
    };
  }
}
