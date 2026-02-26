import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  console.log('Seeding database...');

  // Create a demo user
  const hashedPassword = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@workspace-ai.com' },
    update: {},
    create: {
      email: 'demo@workspace-ai.com',
      password: hashedPassword,
      name: 'Demo User',
      settings: { theme: 'dark', notifications: true },
    },
  });

  console.log(`Created user: ${user.email}`);

  // Create main agent
  const mainAgent = await prisma.agent.upsert({
    where: { userId_name: { userId: user.id, name: 'Atlas' } },
    update: {},
    create: {
      userId: user.id,
      name: 'Atlas',
      role: 'Main Orchestrator',
      specialty: ['task delegation', 'team management', 'strategic planning'],
      isMainAgent: true,
      status: 'active',
      capabilities: [
        'create_task',
        'create_team',
        'send_message',
        'broadcast',
        'manage_agents',
      ],
    },
  });

  console.log(`Created main agent: ${mainAgent.name}`);

  // Create main agent context
  await prisma.agentContext.upsert({
    where: { agentId: mainAgent.id },
    update: {},
    create: { agentId: mainAgent.id },
  });

  // Create a sample team
  const team = await prisma.team.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      userId: user.id,
      name: 'Data Analysis',
      description: 'Team specialized in data collection, analysis, and visualization',
      goal: 'Analyze business data and generate actionable insights',
      leadAgentId: null,
      status: 'active',
    },
  });

  console.log(`Created team: ${team.name}`);

  // Create team agents
  const agentConfigs = [
    {
      name: 'DataCollector',
      role: 'Data Specialist',
      specialty: ['CSV parsing', 'data extraction', 'file analysis'],
      capabilities: ['read_file', 'write_file', 'web_search'],
    },
    {
      name: 'Analyst',
      role: 'Analysis Expert',
      specialty: ['statistical analysis', 'trend detection', 'reporting'],
      capabilities: ['read_file', 'create_file'],
    },
    {
      name: 'Visualizer',
      role: 'Chart Creator',
      specialty: ['data visualization', 'chart creation', 'dashboard design'],
      capabilities: ['read_file', 'create_file'],
    },
  ];

  for (const config of agentConfigs) {
    const agent = await prisma.agent.upsert({
      where: { userId_name: { userId: user.id, name: config.name } },
      update: {},
      create: {
        userId: user.id,
        teamId: team.id,
        name: config.name,
        role: config.role,
        specialty: config.specialty,
        capabilities: config.capabilities,
        status: 'idle',
      },
    });

    await prisma.agentContext.upsert({
      where: { agentId: agent.id },
      update: {},
      create: { agentId: agent.id },
    });

    console.log(`Created agent: ${agent.name} (${agent.role})`);
  }

  // Create a sample task
  await prisma.task.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      userId: user.id,
      teamId: team.id,
      title: 'Analyze Q4 Sales Data',
      description:
        'Review all Q4 2025 sales data, identify key trends, and generate a summary report with actionable insights.',
      priority: 'high',
      status: 'pending',
      createdByAgentId: mainAgent.id,
      progress: 0,
    },
  });

  console.log('Created sample task');

  // Seed integrations catalog
  const integrations = [
    {
      name: 'Slack',
      slug: 'slack',
      description: 'Send messages, create channels, and get notifications from Slack workspaces.',
      category: 'communication',
      iconUrl: '/integrations/slack.svg',
      website: 'https://slack.com',
      authType: 'oauth2',
      authConfig: { scopes: ['chat:write', 'channels:read', 'users:read'] },
      actions: [
        { name: 'send_message', label: 'Send Message', description: 'Send a message to a channel or user' },
        { name: 'create_channel', label: 'Create Channel', description: 'Create a new Slack channel' },
        { name: 'list_channels', label: 'List Channels', description: 'List all channels in the workspace' },
      ],
    },
    {
      name: 'GitHub',
      slug: 'github',
      description: 'Manage repositories, issues, pull requests, and automate workflows on GitHub.',
      category: 'development',
      iconUrl: '/integrations/github.svg',
      website: 'https://github.com',
      authType: 'oauth2',
      authConfig: { scopes: ['repo', 'issues', 'pull_requests'] },
      actions: [
        { name: 'create_issue', label: 'Create Issue', description: 'Create a new GitHub issue' },
        { name: 'create_pr', label: 'Create Pull Request', description: 'Create a new pull request' },
        { name: 'list_repos', label: 'List Repositories', description: 'List user repositories' },
      ],
    },
    {
      name: 'Google Drive',
      slug: 'google-drive',
      description: 'Access, create, and manage files and folders in Google Drive.',
      category: 'storage',
      iconUrl: '/integrations/google-drive.svg',
      website: 'https://drive.google.com',
      authType: 'oauth2',
      authConfig: { scopes: ['drive.readonly', 'drive.file'] },
      actions: [
        { name: 'list_files', label: 'List Files', description: 'List files in Google Drive' },
        { name: 'upload_file', label: 'Upload File', description: 'Upload a file to Google Drive' },
        { name: 'download_file', label: 'Download File', description: 'Download a file from Google Drive' },
      ],
    },
    {
      name: 'Jira',
      slug: 'jira',
      description: 'Create and track issues, manage sprints, and sync project status with Jira.',
      category: 'project_management',
      iconUrl: '/integrations/jira.svg',
      website: 'https://www.atlassian.com/software/jira',
      authType: 'oauth2',
      authConfig: { scopes: ['read:jira-work', 'write:jira-work'] },
      actions: [
        { name: 'create_issue', label: 'Create Issue', description: 'Create a new Jira issue' },
        { name: 'update_issue', label: 'Update Issue', description: 'Update an existing issue' },
        { name: 'list_projects', label: 'List Projects', description: 'List all Jira projects' },
      ],
    },
    {
      name: 'Notion',
      slug: 'notion',
      description: 'Create pages, manage databases, and organize knowledge in Notion.',
      category: 'project_management',
      iconUrl: '/integrations/notion.svg',
      website: 'https://www.notion.so',
      authType: 'oauth2',
      authConfig: { scopes: ['read_content', 'insert_content'] },
      actions: [
        { name: 'create_page', label: 'Create Page', description: 'Create a new Notion page' },
        { name: 'query_database', label: 'Query Database', description: 'Query a Notion database' },
        { name: 'update_page', label: 'Update Page', description: 'Update an existing page' },
      ],
    },
    {
      name: 'Gmail',
      slug: 'gmail',
      description: 'Read, send, and manage emails through Gmail.',
      category: 'communication',
      iconUrl: '/integrations/gmail.svg',
      website: 'https://mail.google.com',
      authType: 'oauth2',
      authConfig: { scopes: ['gmail.readonly', 'gmail.send'] },
      actions: [
        { name: 'send_email', label: 'Send Email', description: 'Send an email' },
        { name: 'read_inbox', label: 'Read Inbox', description: 'Read recent emails' },
        { name: 'search_emails', label: 'Search Emails', description: 'Search emails by query' },
      ],
    },
    {
      name: 'Trello',
      slug: 'trello',
      description: 'Manage boards, lists, and cards for project tracking in Trello.',
      category: 'project_management',
      iconUrl: '/integrations/trello.svg',
      website: 'https://trello.com',
      authType: 'api_key',
      authConfig: {},
      actions: [
        { name: 'create_card', label: 'Create Card', description: 'Create a new Trello card' },
        { name: 'move_card', label: 'Move Card', description: 'Move a card to a different list' },
        { name: 'list_boards', label: 'List Boards', description: 'List all Trello boards' },
      ],
    },
    {
      name: 'Microsoft Teams',
      slug: 'microsoft-teams',
      description: 'Send messages, schedule meetings, and collaborate through Microsoft Teams.',
      category: 'communication',
      iconUrl: '/integrations/teams.svg',
      website: 'https://teams.microsoft.com',
      authType: 'oauth2',
      authConfig: { scopes: ['Chat.ReadWrite', 'Channel.ReadBasic.All'] },
      actions: [
        { name: 'send_message', label: 'Send Message', description: 'Send a message in a Teams channel' },
        { name: 'list_channels', label: 'List Channels', description: 'List channels in a team' },
      ],
    },
    {
      name: 'Salesforce',
      slug: 'salesforce',
      description: 'Manage leads, contacts, opportunities, and customer data in Salesforce.',
      category: 'crm',
      iconUrl: '/integrations/salesforce.svg',
      website: 'https://www.salesforce.com',
      authType: 'oauth2',
      authConfig: { scopes: ['api', 'refresh_token'] },
      actions: [
        { name: 'create_lead', label: 'Create Lead', description: 'Create a new Salesforce lead' },
        { name: 'update_contact', label: 'Update Contact', description: 'Update contact information' },
        { name: 'query_records', label: 'Query Records', description: 'Query Salesforce records via SOQL' },
      ],
    },
    {
      name: 'HubSpot',
      slug: 'hubspot',
      description: 'Manage contacts, deals, and marketing campaigns in HubSpot CRM.',
      category: 'crm',
      iconUrl: '/integrations/hubspot.svg',
      website: 'https://www.hubspot.com',
      authType: 'oauth2',
      authConfig: { scopes: ['contacts', 'deals'] },
      actions: [
        { name: 'create_contact', label: 'Create Contact', description: 'Create a new HubSpot contact' },
        { name: 'create_deal', label: 'Create Deal', description: 'Create a new deal' },
        { name: 'list_contacts', label: 'List Contacts', description: 'List CRM contacts' },
      ],
    },
    {
      name: 'Google Analytics',
      slug: 'google-analytics',
      description: 'Access website analytics, traffic reports, and user behavior data.',
      category: 'analytics',
      iconUrl: '/integrations/google-analytics.svg',
      website: 'https://analytics.google.com',
      authType: 'oauth2',
      authConfig: { scopes: ['analytics.readonly'] },
      actions: [
        { name: 'get_report', label: 'Get Report', description: 'Generate an analytics report' },
        { name: 'get_realtime', label: 'Real-time Data', description: 'Get real-time visitor data' },
      ],
    },
    {
      name: 'Dropbox',
      slug: 'dropbox',
      description: 'Store, share, and synchronize files with Dropbox cloud storage.',
      category: 'storage',
      iconUrl: '/integrations/dropbox.svg',
      website: 'https://www.dropbox.com',
      authType: 'oauth2',
      authConfig: { scopes: ['files.metadata.read', 'files.content.read', 'files.content.write'] },
      actions: [
        { name: 'upload_file', label: 'Upload File', description: 'Upload a file to Dropbox' },
        { name: 'list_files', label: 'List Files', description: 'List files in a folder' },
        { name: 'download_file', label: 'Download File', description: 'Download a file from Dropbox' },
      ],
    },
    {
      name: 'Linear',
      slug: 'linear',
      description: 'Track issues, plan sprints, and manage software projects with Linear.',
      category: 'project_management',
      iconUrl: '/integrations/linear.svg',
      website: 'https://linear.app',
      authType: 'oauth2',
      authConfig: { scopes: ['read', 'write'] },
      actions: [
        { name: 'create_issue', label: 'Create Issue', description: 'Create a new Linear issue' },
        { name: 'list_issues', label: 'List Issues', description: 'List issues in a project' },
        { name: 'update_issue', label: 'Update Issue', description: 'Update an existing issue' },
      ],
    },
    {
      name: 'Figma',
      slug: 'figma',
      description: 'Access design files, export assets, and get design token data from Figma.',
      category: 'development',
      iconUrl: '/integrations/figma.svg',
      website: 'https://www.figma.com',
      authType: 'oauth2',
      authConfig: { scopes: ['file_read'] },
      actions: [
        { name: 'get_file', label: 'Get File', description: 'Get a Figma design file' },
        { name: 'export_assets', label: 'Export Assets', description: 'Export images from a Figma file' },
        { name: 'list_projects', label: 'List Projects', description: 'List team projects' },
      ],
    },
    {
      name: 'Google Calendar',
      slug: 'google-calendar',
      description: 'Create events, manage calendars, and check availability with Google Calendar.',
      category: 'communication',
      iconUrl: '/integrations/google-calendar.svg',
      website: 'https://calendar.google.com',
      authType: 'oauth2',
      authConfig: { scopes: ['calendar.readonly', 'calendar.events'] },
      actions: [
        { name: 'create_event', label: 'Create Event', description: 'Create a new calendar event' },
        { name: 'list_events', label: 'List Events', description: 'List upcoming events' },
        { name: 'check_availability', label: 'Check Availability', description: 'Check free/busy status' },
      ],
    },
  ];

  for (const intg of integrations) {
    await prisma.integration.upsert({
      where: { slug: intg.slug },
      update: {
        name: intg.name,
        description: intg.description,
        category: intg.category,
        iconUrl: intg.iconUrl,
        website: intg.website,
        authType: intg.authType,
        authConfig: intg.authConfig,
        actions: intg.actions,
      },
      create: intg,
    });
  }

  console.log(`Seeded ${integrations.length} integrations`);
  console.log('Seed complete!');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
