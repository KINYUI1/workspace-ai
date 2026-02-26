/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationAdapter, ActionInput, ActionResult } from './types';
import { logger } from '../../../utils/logger';

export class GitHubAdapter implements IntegrationAdapter {
  slug = 'github';

  private async githubFetch(
    endpoint: string,
    credentials: Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = (credentials.accessToken || credentials.apiKey) as string;
    return fetch(`https://api.github.com${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });
  }

  async testConnection(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await this.githubFetch('/user', credentials);
      return res.ok;
    } catch {
      return false;
    }
  }

  async executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult> {
    try {
      switch (actionName) {
        case 'list_repos':
          return await this.listRepos(credentials, input);
        case 'create_issue':
          return await this.createIssue(credentials, input);
        case 'list_issues':
          return await this.listIssues(credentials, input);
        case 'create_pr':
          return await this.createPullRequest(credentials, input);
        case 'get_user':
          return await this.getUser(credentials);
        case 'list_pulls':
          return await this.listPullRequests(credentials, input);
        case 'get_repo':
          return await this.getRepo(credentials, input);
        default:
          return { success: false, error: `Unknown action: ${actionName}` };
      }
    } catch (err) {
      logger.error('GitHub action failed', { actionName, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }

  private async getUser(credentials: Record<string, unknown>): Promise<ActionResult> {
    const res = await this.githubFetch('/user', credentials);
    if (!res.ok) return { success: false, error: `GitHub API error: ${res.status}` };
    const data = await res.json() as any;
    return {
      success: true,
      data: {
        login: data.login,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
        publicRepos: data.public_repos,
        followers: data.followers,
      },
    };
  }

  private async listRepos(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const perPage = (input.perPage as number) || 30;
    const page = (input.page as number) || 1;
    const sort = (input.sort as string) || 'updated';
    const res = await this.githubFetch(`/user/repos?per_page=${perPage}&page=${page}&sort=${sort}`, credentials);
    if (!res.ok) return { success: false, error: `GitHub API error: ${res.status}` };
    const repos = await res.json() as any;
    return {
      success: true,
      data: repos.map((r: Record<string, unknown>) => ({
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        private: r.private,
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        updatedAt: r.updated_at,
        htmlUrl: r.html_url,
      })),
    };
  }

  private async getRepo(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const owner = input.owner as string;
    const repo = input.repo as string;
    if (!owner || !repo) return { success: false, error: 'owner and repo are required' };
    const res = await this.githubFetch(`/repos/${owner}/${repo}`, credentials);
    if (!res.ok) return { success: false, error: `GitHub API error: ${res.status}` };
    const data = await res.json() as any;
    return { success: true, data };
  }

  private async createIssue(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const owner = input.owner as string;
    const repo = input.repo as string;
    const title = input.title as string;
    const body = (input.body as string) || '';
    const labels = (input.labels as string[]) || [];

    if (!owner || !repo || !title) {
      return { success: false, error: 'owner, repo, and title are required' };
    }

    const res = await this.githubFetch(`/repos/${owner}/${repo}/issues`, credentials, {
      method: 'POST',
      body: JSON.stringify({ title, body, labels }),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.message || `GitHub API error: ${res.status}` };
    }

    const issue = await res.json() as any;
    return {
      success: true,
      data: {
        number: issue.number,
        title: issue.title,
        htmlUrl: issue.html_url,
        state: issue.state,
      },
    };
  }

  private async listIssues(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const owner = input.owner as string;
    const repo = input.repo as string;
    const state = (input.state as string) || 'open';
    const perPage = (input.perPage as number) || 20;

    if (!owner || !repo) return { success: false, error: 'owner and repo are required' };

    const res = await this.githubFetch(
      `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}`,
      credentials,
    );
    if (!res.ok) return { success: false, error: `GitHub API error: ${res.status}` };
    const issues = await res.json() as any;
    return {
      success: true,
      data: issues.map((i: Record<string, unknown>) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        labels: (i.labels as Array<Record<string, unknown>>)?.map((l) => l.name),
        createdAt: i.created_at,
        htmlUrl: i.html_url,
      })),
    };
  }

  private async createPullRequest(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const owner = input.owner as string;
    const repo = input.repo as string;
    const title = input.title as string;
    const head = input.head as string;
    const base = (input.base as string) || 'main';
    const body = (input.body as string) || '';

    if (!owner || !repo || !title || !head) {
      return { success: false, error: 'owner, repo, title, and head branch are required' };
    }

    const res = await this.githubFetch(`/repos/${owner}/${repo}/pulls`, credentials, {
      method: 'POST',
      body: JSON.stringify({ title, head, base, body }),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return { success: false, error: err.message || `GitHub API error: ${res.status}` };
    }

    const pr = await res.json() as any;
    return {
      success: true,
      data: {
        number: pr.number,
        title: pr.title,
        htmlUrl: pr.html_url,
        state: pr.state,
      },
    };
  }

  private async listPullRequests(credentials: Record<string, unknown>, input: ActionInput): Promise<ActionResult> {
    const owner = input.owner as string;
    const repo = input.repo as string;
    const state = (input.state as string) || 'open';
    const perPage = (input.perPage as number) || 20;

    if (!owner || !repo) return { success: false, error: 'owner and repo are required' };

    const res = await this.githubFetch(
      `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}`,
      credentials,
    );
    if (!res.ok) return { success: false, error: `GitHub API error: ${res.status}` };
    const pulls = await res.json() as any;
    return {
      success: true,
      data: pulls.map((p: Record<string, unknown>) => ({
        number: p.number,
        title: p.title,
        state: p.state,
        createdAt: p.created_at,
        htmlUrl: p.html_url,
      })),
    };
  }
}
