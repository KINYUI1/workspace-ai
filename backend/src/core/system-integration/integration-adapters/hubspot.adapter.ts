/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class HubSpotAdapter implements IntegrationAdapter {
  slug = 'hubspot';

  private async hubspotFetch(
    endpoint: string,
    credentials: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = (credentials.accessToken || credentials.apiKey) as string;
    return fetch(`https://api.hubapi.com${endpoint}`, {
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
      const res = await this.hubspotFetch('/crm/v3/objects/contacts?limit=1', credentials);
      return res.ok;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (actionName) {
        case 'create_contact':
          return await this.createContact(credentials, input);
        case 'create_deal':
          return await this.createDeal(credentials, input);
        case 'list_contacts':
          return await this.listContacts(credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('HubSpot action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async createContact(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const email = input.email as string;
    if (!email) return { success: false, error: 'email is required' };

    const properties: Record<string, string> = { email };
    if (input.firstname) properties.firstname = input.firstname as string;
    if (input.lastname) properties.lastname = input.lastname as string;
    if (input.phone) properties.phone = input.phone as string;
    if (input.company) properties.company = input.company as string;

    const res = await this.hubspotFetch('/crm/v3/objects/contacts', credentials, {
      method: 'POST',
      body: JSON.stringify({ properties }),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.message || `HubSpot API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return { success: true, data: { id: data.id, properties: data.properties } };
  }

  private async createDeal(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const dealname = input.dealname as string;
    if (!dealname) return { success: false, error: 'dealname is required' };

    const properties: Record<string, string> = { dealname };
    if (input.amount) properties.amount = String(input.amount);
    if (input.pipeline) properties.pipeline = input.pipeline as string;
    if (input.dealstage) properties.dealstage = input.dealstage as string;

    const res = await this.hubspotFetch('/crm/v3/objects/deals', credentials, {
      method: 'POST',
      body: JSON.stringify({ properties }),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.message || `HubSpot API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return { success: true, data: { id: data.id, properties: data.properties } };
  }

  private async listContacts(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const limit = (input.limit as number) || 20;
    const res = await this.hubspotFetch(`/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,phone,company`, credentials);
    if (!res.ok) return { success: false, error: `HubSpot API error: ${res.status}` };
    const data = await res.json() as any;
    return {
      success: true,
      data: {
        results: (data.results || []).map((c: any) => ({
          id: c.id,
          email: c.properties?.email,
          firstname: c.properties?.firstname,
          lastname: c.properties?.lastname,
          phone: c.properties?.phone,
          company: c.properties?.company,
        })),
        total: data.total,
      },
    };
  }
}
