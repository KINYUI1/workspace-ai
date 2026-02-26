/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class LinearAdapter implements IntegrationAdapter {
  slug = 'linear';

  private async linearGraphQL(
    query: string,
    variables: Record<string, unknown>,
    credentials: Record<string, unknown>,
  ): Promise<any> {
    const token = (credentials.apiKey || credentials.accessToken) as string;
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) throw new Error(`Linear API error: ${res.status}`);
    const data = await res.json() as any;
    if (data.errors) throw new Error(data.errors[0]?.message || 'GraphQL error');
    return data.data;
  }

  async testConnection(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      await this.linearGraphQL('{ viewer { id name } }', {}, credentials);
      return true;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (actionName) {
        case 'create_issue':
          return await this.createIssue(credentials, input);
        case 'list_issues':
          return await this.listIssues(credentials, input);
        case 'update_issue':
          return await this.updateIssue(credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('Linear action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async createIssue(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const teamId = input.teamId as string;
    const title = input.title as string;
    if (!teamId || !title) return { success: false, error: 'teamId and title are required' };

    const variables: Record<string, unknown> = { teamId, title };
    if (input.description) variables.description = input.description;
    if (input.priority) variables.priority = input.priority;

    const data = await this.linearGraphQL(
      `mutation CreateIssue($teamId: String!, $title: String!, $description: String, $priority: Int) {
        issueCreate(input: { teamId: $teamId, title: $title, description: $description, priority: $priority }) {
          success
          issue { id identifier title url priority state { name } }
        }
      }`,
      variables,
      credentials,
    );

    if (!data.issueCreate.success) return { success: false, error: 'Failed to create issue' };
    return { success: true, data: data.issueCreate.issue };
  }

  private async listIssues(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const first = (input.limit as number) || 20;

    const filterObj: Record<string, unknown> = {};
    if (input.teamId) filterObj.team = { id: { eq: input.teamId } };
    if (input.state) filterObj.state = { name: { eq: input.state } };

    const data = await this.linearGraphQL(
      `query ListIssues($first: Int!, $filter: IssueFilter) {
        issues(first: $first, filter: $filter, orderBy: updatedAt) {
          nodes { id identifier title url priority state { name } assignee { name } createdAt updatedAt }
        }
      }`,
      { first, filter: Object.keys(filterObj).length > 0 ? filterObj : undefined },
      credentials,
    );

    return {
      success: true,
      data: data.issues.nodes,
    };
  }

  private async updateIssue(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const issueId = input.issueId as string;
    if (!issueId) return { success: false, error: 'issueId is required' };

    const updateInput: Record<string, unknown> = {};
    if (input.title) updateInput.title = input.title;
    if (input.description) updateInput.description = input.description;
    if (input.priority !== undefined) updateInput.priority = input.priority;
    if (input.stateId) updateInput.stateId = input.stateId;

    const data = await this.linearGraphQL(
      `mutation UpdateIssue($issueId: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $issueId, input: $input) {
          success
          issue { id identifier title url state { name } }
        }
      }`,
      { issueId, input: updateInput },
      credentials,
    );

    if (!data.issueUpdate.success) return { success: false, error: 'Failed to update issue' };
    return { success: true, data: data.issueUpdate.issue };
  }
}
