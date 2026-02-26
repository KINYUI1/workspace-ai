import { IntegrationAdapter } from './types';
import { GitHubAdapter } from './github.adapter';
import { SlackAdapter } from './slack.adapter';
import { GoogleDriveAdapter, GmailAdapter, GoogleCalendarAdapter } from './google.adapter';
import { JiraAdapter } from './jira.adapter';
import { NotionAdapter } from './notion.adapter';
import { TrelloAdapter } from './trello.adapter';
import { MicrosoftTeamsAdapter } from './teams.adapter';
import { SalesforceAdapter } from './salesforce.adapter';
import { HubSpotAdapter } from './hubspot.adapter';
import { GoogleAnalyticsAdapter } from './analytics.adapter';
import { DropboxAdapter } from './dropbox.adapter';
import { LinearAdapter } from './linear.adapter';
import { FigmaAdapter } from './figma.adapter';

export type { IntegrationAdapter, ActionInput, ActionResult } from './types';

const adapters = new Map<string, IntegrationAdapter>();

function register(adapter: IntegrationAdapter) {
  adapters.set(adapter.slug, adapter);
}

// Register all adapters
register(new GitHubAdapter());
register(new SlackAdapter());
register(new GoogleDriveAdapter());
register(new GmailAdapter());
register(new GoogleCalendarAdapter());
register(new JiraAdapter());
register(new NotionAdapter());
register(new TrelloAdapter());
register(new MicrosoftTeamsAdapter());
register(new SalesforceAdapter());
register(new HubSpotAdapter());
register(new GoogleAnalyticsAdapter());
register(new DropboxAdapter());
register(new LinearAdapter());
register(new FigmaAdapter());

export function getAdapter(slug: string): IntegrationAdapter | undefined {
  return adapters.get(slug);
}

export function hasAdapter(slug: string): boolean {
  return adapters.has(slug);
}

export function listAdapterSlugs(): string[] {
  return Array.from(adapters.keys());
}
