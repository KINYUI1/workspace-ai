/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class GoogleDriveAdapter implements IntegrationAdapter {
  slug = 'google-drive';

  private async googleFetch(
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
      const res = await this.googleFetch('https://www.googleapis.com/drive/v3/about?fields=user', credentials);
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
        case 'get_file':
          return await this.getFile(credentials, input);
        case 'search_files':
          return await this.searchFiles(credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Google Drive action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async listFiles(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const pageSize = (input.pageSize as number) || 20;
    const folderId = input.folderId as string;
    let q = "trashed = false";
    if (folderId) q += ` and '${folderId}' in parents`;

    const params = new URLSearchParams({
      pageSize: String(pageSize),
      q,
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
    });

    const res = await this.googleFetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      credentials,
    );
    if (!res.ok) return { success: false, error: `Google API error: ${res.status}` };
    const data = await res.json() as any;

    return {
      success: true,
      data: data.files.map((f: Record<string, unknown>) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink,
      })),
    };
  }

  private async getFile(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const fileId = input.fileId as string;
    if (!fileId) return { success: false, error: 'fileId is required' };

    const res = await this.googleFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,webViewLink,description`,
      credentials,
    );
    if (!res.ok) return { success: false, error: `Google API error: ${res.status}` };
    const data = await res.json() as any;
    return { success: true, data };
  }

  private async searchFiles(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const query = input.query as string;
    if (!query) return { success: false, error: 'query is required' };

    const params = new URLSearchParams({
      q: `name contains '${query}' and trashed = false`,
      pageSize: '20',
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
    });

    const res = await this.googleFetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      credentials,
    );
    if (!res.ok) return { success: false, error: `Google API error: ${res.status}` };
    const data = await res.json() as any;
    return { success: true, data: data.files };
  }
}

export class GmailAdapter implements IntegrationAdapter {
  slug = 'gmail';

  private async gmailFetch(
    endpoint: string,
    credentials: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = credentials.accessToken as string;
    return fetch(`https://gmail.googleapis.com/gmail/v1/users/me${endpoint}`, {
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
      const res = await this.gmailFetch('/profile', credentials);
      return res.ok;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (actionName) {
        case 'read_inbox':
          return await this.readInbox(credentials, input);
        case 'search_emails':
          return await this.searchEmails(credentials, input);
        case 'send_email':
          return await this.sendEmail(credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Gmail action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async readInbox(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const maxResults = (input.maxResults as number) || 10;
    const res = await this.gmailFetch(`/messages?maxResults=${maxResults}&labelIds=INBOX`, credentials);
    if (!res.ok) return { success: false, error: `Gmail API error: ${res.status}` };
    const data = await res.json() as any;

    // Fetch brief details for each message
    const messages = [];
    for (const msg of (data.messages || []).slice(0, maxResults)) {
      const detail = await this.gmailFetch(`/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, credentials);
      if (detail.ok) {
        const d = await detail.json() as any;
        const headers = d.payload?.headers || [];
        messages.push({
          id: d.id,
          snippet: d.snippet,
          subject: headers.find((h: Record<string, string>) => h.name === 'Subject')?.value,
          from: headers.find((h: Record<string, string>) => h.name === 'From')?.value,
          date: headers.find((h: Record<string, string>) => h.name === 'Date')?.value,
        });
      }
    }

    return { success: true, data: messages };
  }

  private async searchEmails(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const query = input.query as string;
    if (!query) return { success: false, error: 'query is required' };
    const maxResults = (input.maxResults as number) || 10;

    const res = await this.gmailFetch(`/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, credentials);
    if (!res.ok) return { success: false, error: `Gmail API error: ${res.status}` };
    const data = await res.json() as any;
    return { success: true, data: { resultCount: data.resultSizeEstimate, messageIds: (data.messages || []).map((m: Record<string, string>) => m.id) } };
  }

  private async sendEmail(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const to = input.to as string;
    const subject = input.subject as string;
    const body = input.body as string;
    if (!to || !subject || !body) return { success: false, error: 'to, subject, and body are required' };

    const raw = Buffer.from(
      `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`,
    ).toString('base64url');

    const res = await this.gmailFetch('/messages/send', credentials, {
      method: 'POST',
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) return { success: false, error: `Gmail API error: ${res.status}` };
    const data = await res.json() as any;
    return { success: true, data: { id: data.id, threadId: data.threadId } };
  }
}

export class GoogleCalendarAdapter implements IntegrationAdapter {
  slug = 'google-calendar';

  private async calFetch(
    endpoint: string,
    credentials: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = credentials.accessToken as string;
    return fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
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
      const res = await this.calFetch('/calendars/primary', credentials);
      return res.ok;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (actionName) {
        case 'list_events':
          return await this.listEvents(credentials, input);
        case 'create_event':
          return await this.createEvent(credentials, input);
        case 'check_availability':
          return await this.checkAvailability(credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Google Calendar action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async listEvents(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const maxResults = (input.maxResults as number) || 10;
    const timeMin = (input.timeMin as string) || new Date().toISOString();

    const params = new URLSearchParams({
      maxResults: String(maxResults),
      timeMin,
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const res = await this.calFetch(`/calendars/primary/events?${params}`, credentials);
    if (!res.ok) return { success: false, error: `Calendar API error: ${res.status}` };
    const data = await res.json() as any;

    return {
      success: true,
      data: (data.items || []).map((e: Record<string, unknown>) => ({
        id: e.id,
        summary: e.summary,
        start: (e.start as Record<string, unknown>)?.dateTime || (e.start as Record<string, unknown>)?.date,
        end: (e.end as Record<string, unknown>)?.dateTime || (e.end as Record<string, unknown>)?.date,
        location: e.location,
        status: e.status,
        htmlLink: e.htmlLink,
      })),
    };
  }

  private async createEvent(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const summary = input.summary as string;
    const startTime = input.startTime as string;
    const endTime = input.endTime as string;
    if (!summary || !startTime || !endTime) return { success: false, error: 'summary, startTime, and endTime are required' };

    const event = {
      summary,
      description: input.description || '',
      location: input.location || '',
      start: { dateTime: startTime, timeZone: (input.timeZone as string) || 'UTC' },
      end: { dateTime: endTime, timeZone: (input.timeZone as string) || 'UTC' },
    };

    const res = await this.calFetch('/calendars/primary/events', credentials, {
      method: 'POST',
      body: JSON.stringify(event),
    });

    if (!res.ok) return { success: false, error: `Calendar API error: ${res.status}` };
    const data = await res.json() as any;
    return { success: true, data: { id: data.id, summary: data.summary, htmlLink: data.htmlLink } };
  }

  private async checkAvailability(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const timeMin = (input.timeMin as string) || new Date().toISOString();
    const timeMax = input.timeMax as string;
    if (!timeMax) return { success: false, error: 'timeMax is required' };

    const res = await this.calFetch('/freeBusy', credentials, {
      method: 'POST',
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: 'primary' }],
      }),
    });

    if (!res.ok) return { success: false, error: `Calendar API error: ${res.status}` };
    const data = await res.json() as any;
    const busy = data.calendars?.primary?.busy || [];
    return { success: true, data: { busy, freeSlots: busy.length === 0 ? 'All clear' : `${busy.length} busy slot(s)` } };
  }
}
