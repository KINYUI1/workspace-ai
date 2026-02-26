/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class JiraAdapter implements IntegrationAdapter {
  slug = 'jira';

  private async jiraFetch(
    domain: string,
    endpoint: string,
    credentials: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    const email = credentials.email as string;
    const apiKey = credentials.apiKey as string;
    const auth = Buffer.from(`${email}:${apiKey}`).toString('base64');

    return fetch(`https://${domain}/rest/api/3${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });
  }

  private getDomain(credentials: Record<string, unknown>): string {
    return (credentials.domain as string) || '';
  }

  async testConnection(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      const domain = this.getDomain(credentials);
      if (!domain) return false;
      const res = await this.jiraFetch(domain, '/myself', credentials);
      return res.ok;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      const domain = this.getDomain(credentials);
      if (!domain) return { success: false, error: 'Jira domain is required in credentials' };

      switch (actionName) {
        case 'create_issue':
          return await this.createIssue(domain, credentials, input);
        case 'update_issue':
          return await this.updateIssue(domain, credentials, input);
        case 'list_projects':
          return await this.listProjects(domain, credentials);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Jira action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async createIssue(domain: string, credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const projectKey = input.projectKey as string;
    const summary = input.summary as string;
    const issueType = (input.issueType as string) || 'Task';
    if (!projectKey || !summary) return { success: false, error: 'projectKey and summary are required' };

    const res = await this.jiraFetch(domain, '/issue', credentials, {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary,
          description: input.description ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: input.description as string }] }] } : undefined,
          issuetype: { name: issueType },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.errorMessages?.join(', ') || `Jira API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return { success: true, data: { id: data.id, key: data.key, self: data.self } };
  }

  private async updateIssue(domain: string, credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const issueKey = input.issueKey as string;
    if (!issueKey) return { success: false, error: 'issueKey is required' };

    const fields: Record<string, unknown> = {};
    if (input.summary) fields.summary = input.summary;
    if (input.status) {
      // Status transitions require a separate call
      const transRes = await this.jiraFetch(domain, `/issue/${issueKey}/transitions`, credentials);
      if (transRes.ok) {
        const transData = await transRes.json() as any;
        const transition = transData.transitions?.find((t: any) => t.name.toLowerCase() === (input.status as string).toLowerCase());
        if (transition) {
          await this.jiraFetch(domain, `/issue/${issueKey}/transitions`, credentials, {
            method: 'POST',
            body: JSON.stringify({ transition: { id: transition.id } }),
          });
        }
      }
    }

    if (Object.keys(fields).length > 0) {
      const res = await this.jiraFetch(domain, `/issue/${issueKey}`, credentials, {
        method: 'PUT',
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) return { success: false, error: `Jira API error: ${res.status}` };
    }

    return { success: true, data: { issueKey, updated: true } };
  }

  private async listProjects(domain: string, credentials: Record<string, unknown>): Promise<ActionResult> {
    const res = await this.jiraFetch(domain, '/project', credentials);
    if (!res.ok) return { success: false, error: `Jira API error: ${res.status}` };
    const data = await res.json() as any;
    return {
      success: true,
      data: data.map((p: any) => ({
        id: p.id,
        key: p.key,
        name: p.name,
        projectTypeKey: p.projectTypeKey,
      })),
    };
  }
}
