import Anthropic from '@anthropic-ai/sdk';
import { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { logger } from '../../utils/logger';
import { AuditService } from '../system-integration/audit.service';
import { PermissionService } from '../system-integration/permission.service';
import { AgentService } from './agent.service';
import { TeamService } from '../orchestration/team.service';
import { TaskService } from '../orchestration/task.service';
import { MessageService } from '../communication/message.service';
import { OrganizationService } from '../orchestration/organization.service';
import { DepartmentService } from '../orchestration/department.service';
import { FileService } from '../system-integration/file.service';
import { WebService } from '../system-integration/web.service';
import { NotificationService } from '../system-integration/notification.service';
import { SandboxService } from '../system-integration/sandbox.service';
import { SkillService } from '../system-integration/skill.service';
import { IntegrationExecutorService } from '../system-integration/integration-executor.service';
import { MemoryService } from './memory.service';
import { SchedulerService } from '../orchestration/scheduler.service';
import { BrowserService } from '../system-integration/browser.service';
import OpenAI from 'openai';
import { TaskDispatcher } from '../orchestration/task-dispatcher';
import { emitToUser } from '../communication/websocket';
import { isValidUuid, areValidUuids } from '../../utils/uuid';
import { env } from '../../config/env';
import type { Agent, Task, TaskPriority, TaskStatus, BroadcastMessage, SyncResponse, PermissionType, PermissionDuration } from '../../../../shared/types';

const MAX_TOOL_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Stream event types for real-time UI updates
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { type: 'stream_start'; agentId: string; agentName: string }
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; text: string }
  | { type: 'tool_use_start'; toolId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolId: string; toolName: string; result: unknown; durationMs: number }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'stream_done'; fullText: string }
  | { type: 'stream_error'; error: string };

/**
 * AgentRuntime manages the execution lifecycle of a single agent.
 * Each active agent has its own runtime instance.
 */
export class AgentRuntime {
  private readonly client: Anthropic;
  private readonly db: PrismaClient;
  private readonly auditService: AuditService;
  private readonly permissionService: PermissionService;
  private readonly agentService: AgentService;
  private readonly teamService: TeamService;
  private readonly taskService: TaskService;
  private readonly messageService: MessageService;
  private readonly taskDispatcher: TaskDispatcher;
  private readonly organizationService: OrganizationService;
  private readonly departmentService: DepartmentService;
  private readonly fileService: FileService;
  private readonly webService: WebService;
  private readonly notificationService: NotificationService;
  private readonly sandboxService: SandboxService;
  private readonly skillService: SkillService;
  private readonly memoryService: MemoryService;
  private readonly schedulerService: SchedulerService;
  private readonly integrationExecutor: IntegrationExecutorService;
  private readonly browserService: BrowserService;
  private userSettings: Record<string, unknown> = {};

  constructor(
    private readonly agent: Agent,
    apiKey: string,
  ) {
    this.client = new Anthropic({ apiKey });
    this.db = getPrismaClient();
    this.auditService = new AuditService();
    this.permissionService = new PermissionService();
    this.agentService = new AgentService();
    this.teamService = new TeamService();
    this.taskService = new TaskService();
    this.messageService = new MessageService();
    this.taskDispatcher = new TaskDispatcher();
    this.organizationService = new OrganizationService();
    this.departmentService = new DepartmentService();
    this.fileService = new FileService();
    this.webService = new WebService();
    this.notificationService = new NotificationService();
    this.sandboxService = new SandboxService();
    this.skillService = new SkillService();
    this.memoryService = new MemoryService();
    this.schedulerService = new SchedulerService();
    this.integrationExecutor = new IntegrationExecutorService();
    this.browserService = BrowserService.getInstance();
  }

  /**
   * Load user settings (API keys, webhook URLs, etc.) from the database.
   */
  private async loadUserSettings(): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { id: this.agent.userId },
      select: { settings: true },
    });
    this.userSettings = (user?.settings as Record<string, unknown>) ?? {};
  }

  /**
   * Execute a task assigned to this agent.
   */
  async executeTask(task: Task): Promise<Record<string, unknown>> {
    logger.info('Agent executing task', {
      agentId: this.agent.id,
      agentName: this.agent.name,
      taskId: task.id,
      taskTitle: task.title,
    });

    try {
      await this.loadUserSettings();
      await this.updateStatus('busy');
      const context = await this.loadContext();

      const reply = await this.runWithToolLoop([
        ...this.formatConversationHistory(context.conversationHistory),
        {
          role: 'user',
          content: `Task: ${task.title}\n\nDescription: ${task.description}\n\nPriority: ${task.priority}\n\nPlease work on this task and report your results.`,
        },
      ]);

      await this.appendToContext({
        role: 'assistant',
        content: reply,
        taskId: task.id,
        timestamp: new Date().toISOString(),
      });

      await this.auditService.log({
        agentId: this.agent.id,
        action: 'execute_task',
        parameters: { taskId: task.id, taskTitle: task.title },
        result: { replyLength: reply.length },
        success: true,
      });

      await this.updateStatus('active');

      return { success: true, output: reply };
    } catch (error) {
      logger.error('Agent task execution failed', {
        agentId: this.agent.id,
        taskId: task.id,
        error: (error as Error).message,
      });

      await this.updateStatus('error');

      await this.auditService.log({
        agentId: this.agent.id,
        action: 'execute_task',
        parameters: { taskId: task.id },
        result: { error: (error as Error).message },
        success: false,
      });

      throw error;
    }
  }

  /**
   * Process a user or inter-agent message.
   * Now supports tool use: Atlas can create teams, agents, tasks, etc.
   */
  async processMessage(content: string, fromLabel: string): Promise<string> {
    logger.info('Agent processing message', {
      agentId: this.agent.id,
      agentName: this.agent.name,
      fromLabel,
    });

    try {
      await this.loadUserSettings();
      await this.updateStatus('busy');
      const context = await this.loadContext();

      const reply = await this.runWithToolLoop([
        ...this.formatConversationHistory(context.conversationHistory),
        {
          role: 'user',
          content: `Message from ${fromLabel}: ${content}`,
        },
      ]);

      await this.appendToContext({
        role: 'user',
        content: `Message from ${fromLabel}: ${content}`,
        timestamp: new Date().toISOString(),
      });

      await this.appendToContext({
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      });

      await this.updateStatus('active');

      logger.info('Agent finished processing message', {
        agentId: this.agent.id,
        agentName: this.agent.name,
        replyLength: reply.length,
      });

      return reply;
    } catch (error) {
      logger.error('Agent message processing failed', {
        agentId: this.agent.id,
        agentName: this.agent.name,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      await this.updateStatus('error');
      throw error;
    }
  }

  /**
   * Process a message with real-time streaming.
   * Yields StreamEvent objects that should be emitted via Socket.io.
   */
  async *processMessageStream(content: string, fromLabel: string): AsyncGenerator<StreamEvent> {
    logger.info('Agent processing message (streaming)', {
      agentId: this.agent.id,
      agentName: this.agent.name,
      fromLabel,
    });

    try {
      await this.loadUserSettings();
      await this.updateStatus('busy');
      const context = await this.loadContext();

      yield { type: 'stream_start', agentId: this.agent.id, agentName: this.agent.name };

      const messages: Anthropic.MessageParam[] = [
        ...this.formatConversationHistory(context.conversationHistory),
        { role: 'user', content: `Message from ${fromLabel}: ${content}` },
      ];

      let fullText = '';

      if (this.agent.modelProvider === 'ollama') {
        // Ollama streaming
        fullText = yield* this.runOllamaToolLoopStream(messages);
      } else {
        // Anthropic streaming
        fullText = yield* this.runAnthropicToolLoopStream(messages);
      }

      // Persist context
      await this.appendToContext({
        role: 'user',
        content: `Message from ${fromLabel}: ${content}`,
        timestamp: new Date().toISOString(),
      });
      await this.appendToContext({
        role: 'assistant',
        content: fullText,
        timestamp: new Date().toISOString(),
      });

      await this.updateStatus('active');

      yield { type: 'stream_done', fullText };
    } catch (error) {
      logger.error('Agent streaming failed', {
        agentId: this.agent.id,
        error: (error as Error).message,
      });
      await this.updateStatus('error');
      yield { type: 'stream_error', error: (error as Error).message };
    }
  }

  /**
   * Anthropic streaming tool loop.
   */
  private async *runAnthropicToolLoopStream(
    messages: Anthropic.MessageParam[],
  ): AsyncGenerator<StreamEvent, string> {
    const conversationMessages = [...messages];
    const tools = await this.getToolDefinitions();
    let fullText = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      logger.info('Agent streaming LLM call', {
        agentId: this.agent.id,
        model: this.getModel(),
        round,
      });

      const stream = this.client.messages.stream({
        model: this.getModel(),
        max_tokens: 4096,
        system: this.buildSystemPrompt(),
        messages: conversationMessages,
        tools,
      });

      // Accumulate the full response for tool processing
      let roundTextParts: string[] = [];
      const toolUseBlocks: Array<{ id: string; name: string; input: string }> = [];
      let currentToolInput = '';
      let currentToolId = '';
      let currentToolName = '';
      let stopReason = '';

      stream.on('text', (text) => {
        fullText += text;
        roundTextParts.push(text);
      });

      // Use event-based streaming
      const finalMessage = await stream.finalMessage();

      // Emit text deltas from the content blocks
      for (const block of finalMessage.content) {
        if (block.type === 'text') {
          // The text was already accumulated via the 'text' event above,
          // but we emit it as a single delta for simplicity after the stream ends.
          // For true per-character streaming, we'd use the raw stream events.
        }
      }

      // Track usage
      if (finalMessage.usage) {
        totalInputTokens += finalMessage.usage.input_tokens;
        totalOutputTokens += finalMessage.usage.output_tokens;
        yield { type: 'usage', inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
      }

      stopReason = finalMessage.stop_reason || '';

      // Emit the text accumulated during this round
      const roundText = roundTextParts.join('');
      if (roundText) {
        yield { type: 'text_delta', text: roundText };
      }

      // If no tool use, we're done
      if (stopReason === 'end_turn' || stopReason !== 'tool_use') {
        return fullText || '[No text response]';
      }

      // Extract tool_use blocks
      const toolBlocks = finalMessage.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      conversationMessages.push({ role: 'assistant', content: finalMessage.content });

      // Execute tools
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolBlock of toolBlocks) {
        const toolInput = toolBlock.input as Record<string, unknown>;

        yield {
          type: 'tool_use_start',
          toolId: toolBlock.id,
          toolName: toolBlock.name,
          input: toolInput,
        };

        const startTime = Date.now();
        const result = await this.executeTool(toolBlock.name, toolInput);
        const durationMs = Date.now() - startTime;

        yield {
          type: 'tool_result',
          toolId: toolBlock.id,
          toolName: toolBlock.name,
          result,
          durationMs,
        };

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(result),
        });
      }

      conversationMessages.push({ role: 'user', content: toolResults });
    }

    return fullText || '[Max tool rounds reached]';
  }

  /**
   * Ollama streaming tool loop.
   */
  private async *runOllamaToolLoopStream(
    messages: Anthropic.MessageParam[],
  ): AsyncGenerator<StreamEvent, string> {
    const ollamaBaseUrl = (this.userSettings.ollamaBaseUrl as string) || env.OLLAMA_BASE_URL;
    const ollamaClient = new OpenAI({
      baseURL: `${ollamaBaseUrl}/v1`,
      apiKey: 'ollama',
    });

    const modelName = this.agent.modelName || 'llama3.2';
    const systemPrompt = this.buildSystemPrompt();
    const anthropicTools = await this.getToolDefinitions();

    const openaiTools: OpenAI.ChatCompletionTool[] = anthropicTools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.input_schema as Record<string, unknown>,
      },
    }));

    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    ];

    let fullText = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = await ollamaClient.chat.completions.create({
        model: modelName,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        stream: true,
      });

      let toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
      let roundText = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          fullText += delta.content;
          roundText += delta.content;
          yield { type: 'text_delta', text: delta.content };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) {
              toolCalls[idx] = { id: tc.id || `tc-${idx}`, name: '', arguments: '' };
            }
            if (tc.function?.name) toolCalls[idx].name = tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments;
          }
        }
      }

      // No tool calls — done
      if (toolCalls.length === 0) {
        return fullText || '[No text response]';
      }

      // Add assistant message with tool calls
      openaiMessages.push({
        role: 'assistant',
        content: roundText || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      // Execute tools
      for (const tc of toolCalls) {
        let fnArgs: Record<string, unknown> = {};
        try { fnArgs = JSON.parse(tc.arguments || '{}'); } catch { fnArgs = {}; }

        yield { type: 'tool_use_start', toolId: tc.id, toolName: tc.name, input: fnArgs };

        const startTime = Date.now();
        const result = await this.executeTool(tc.name, fnArgs);
        const durationMs = Date.now() - startTime;

        yield { type: 'tool_result', toolId: tc.id, toolName: tc.name, result, durationMs };

        openaiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return fullText || '[Max tool rounds reached]';
  }

  /**
   * Handle a sync broadcast from the main agent.
   */
  async receiveBroadcast(broadcast: BroadcastMessage): Promise<SyncResponse> {
    logger.info('Agent received broadcast', {
      agentId: this.agent.id,
      type: broadcast.type,
    });

    try {
      if (broadcast.data.globalContext) {
        await this.db.agentContext.update({
          where: { agentId: this.agent.id },
          data: {
            knowledgeBase: {
              globalContext: broadcast.data.globalContext,
              lastSyncAt: new Date().toISOString(),
            },
          },
        });
      }

      await this.db.agent.update({
        where: { id: this.agent.id },
        data: { lastSyncAt: new Date() },
      });

      return {
        agentId: this.agent.id,
        status: 'success',
        updates: { currentStatus: this.agent.status },
      };
    } catch (error) {
      return {
        agentId: this.agent.id,
        status: 'failed',
        error: (error as Error).message,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Tool-Use Loop
  // ---------------------------------------------------------------------------

  /**
   * Send messages to the LLM and process tool calls in a loop until we get
   * a final text response (or hit MAX_TOOL_ROUNDS).
   */
  private async runWithToolLoop(
    messages: Anthropic.MessageParam[],
  ): Promise<string> {
    if (this.agent.modelProvider === 'ollama') {
      return this.runOllamaToolLoop(messages);
    }
    return this.runAnthropicToolLoop(messages);
  }

  private async runAnthropicToolLoop(
    messages: Anthropic.MessageParam[],
  ): Promise<string> {
    const conversationMessages = [...messages];
    const tools = await this.getToolDefinitions();

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      logger.info('Agent LLM call', {
        agentId: this.agent.id,
        agentName: this.agent.name,
        model: this.getModel(),
        round,
        messageCount: conversationMessages.length,
      });

      const response = await this.client.messages.create({
        model: this.getModel(),
        max_tokens: 4096,
        system: this.buildSystemPrompt(),
        messages: conversationMessages,
        tools,
      });

      logger.info('Agent LLM response', {
        agentId: this.agent.id,
        agentName: this.agent.name,
        stopReason: response.stop_reason,
        contentBlocks: response.content.length,
        blockTypes: response.content.map((b) => b.type),
      });

      // If the model ended the turn (no more tool calls), extract text and return
      if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') {
        const textParts = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text);
        return textParts.join('\n') || '[No text response]';
      }

      // Model wants to use tools — execute each one
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      // Add the assistant message (with tool_use blocks) to the conversation
      conversationMessages.push({ role: 'assistant', content: response.content });

      // Execute tools and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolBlock of toolUseBlocks) {
        const result = await this.executeTool(
          toolBlock.name,
          toolBlock.input as Record<string, unknown>,
        );
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(result),
        });
      }

      // Feed tool results back to the model
      conversationMessages.push({ role: 'user', content: toolResults });
    }

    return '[Max tool rounds reached]';
  }

  /**
   * Ollama tool loop using OpenAI-compatible API.
   */
  private async runOllamaToolLoop(
    messages: Anthropic.MessageParam[],
  ): Promise<string> {
    const ollamaBaseUrl = (this.userSettings.ollamaBaseUrl as string) || env.OLLAMA_BASE_URL;
    const ollamaClient = new OpenAI({
      baseURL: `${ollamaBaseUrl}/v1`,
      apiKey: 'ollama', // Ollama doesn't need a real key
    });

    const modelName = this.agent.modelName || 'llama3.2';
    const systemPrompt = this.buildSystemPrompt();
    const anthropicTools = await this.getToolDefinitions();

    // Convert Anthropic tools to OpenAI function format
    const openaiTools: OpenAI.ChatCompletionTool[] = anthropicTools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.input_schema as Record<string, unknown>,
      },
    }));

    // Convert Anthropic messages to OpenAI format
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await ollamaClient.chat.completions.create({
        model: modelName,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });

      const choice = response.choices[0];
      if (!choice) return '[No response from Ollama]';

      const msg = choice.message;

      // No tool calls — return text
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return msg.content || '[No text response]';
      }

      // Add assistant message with tool calls
      openaiMessages.push(msg);

      // Execute each tool call
      for (const toolCall of msg.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fn = toolCall.function;
        const fnName = fn.name;
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = JSON.parse(fn.arguments || '{}');
        } catch {
          fnArgs = {};
        }

        const result = await this.executeTool(fnName, fnArgs);

        openaiMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    return '[Max tool rounds reached]';
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private getModel(): string {
    // Ollama models are handled in runOllamaToolLoop
    if (this.agent.modelProvider === 'ollama') {
      return this.agent.modelName || 'llama3.2';
    }
    if (this.agent.isMainAgent) {
      return process.env.MAIN_AGENT_MODEL || 'claude-sonnet-4-5-20250929';
    }
    return process.env.DEFAULT_AGENT_MODEL || 'claude-sonnet-4-5-20250929';
  }

  private buildSystemPrompt(): string {
    if (this.agent.isMainAgent) {
      return `You are ${this.agent.name}, the Main Agent for Workspace AI — a multi-agent orchestration platform.

You have FULL CONTROL over this platform. You can create teams, create agents, create tasks, assign agents to teams, and assign tasks to agents. All of these actions are REAL — they persist in the database and appear instantly in the user's dashboard.

Your tools:
- create_team: Creates a real team visible in the Teams tab
- create_agent: Creates a real AI agent that joins the workforce
- add_agent_to_team: Assigns an existing agent to a team
- create_task: Creates a real task and optionally assigns it to agents
- assign_task: Assigns an existing task to agents
- list_agents: See all agents in the workforce
- list_teams: See all teams
- send_message: Message other agents
- update_task_status: Update a task's status and progress
- create_file: Create or update project files (code, configs, docs, etc.)
- list_files: List all project files
- create_organization: Create a top-level organization to group departments
- create_department: Create a department within an organization
- assign_team_to_department: Place a team under a department in the org hierarchy
- search_web: Search the internet for information using Brave Search
- fetch_url: Fetch and read the content of any URL
- notify_channel: Send notifications to Slack/Discord channels
- schedule_task: Schedule a task to run later (one-time or recurring cron)
- recall_memory: Search your long-term memory for past knowledge
- store_memory: Save important facts to long-term memory
- execute_code: Run Python, JavaScript, or Bash code in a sandboxed Docker container
- browse_web: Navigate to a URL in a headless browser and get a screenshot
- browser_click: Click an element on the page by CSS selector
- browser_type: Type text into an input field on the page
- browser_screenshot: Take a screenshot of the current browser page

IMPORTANT: You are an ORCHESTRATOR, not a worker. You must NEVER do the work yourself.
Instead, you create teams, create agents, create tasks, and ASSIGN the tasks to agents.
The agents will execute the tasks AUTONOMOUSLY and report their results back.

Your responsibilities:
1. Understand user needs and translate them into actionable work
2. Create the right teams and specialized agents for the job
3. Break down complex requests into clear, specific tasks
4. ASSIGN tasks to agents using the create_task tool with the assignTo parameter
5. Report to the user what you've set up and that agents are working on it

When the user gives you a project:
1. Use list_agents and list_teams to see what already exists
2. Create a team for the project with a clear goal
3. Create specialized agents with the right roles and specialties
4. Add agents to the team
5. Break the work into specific tasks with clear descriptions
6. Create each task with assignTo set to the relevant agent IDs
7. Tell the user: "I've set up [team] with [agents] and dispatched [N] tasks. The agents are now working autonomously and will report back when done."

When assigning tasks:
- Give each task a clear, specific description of what to produce
- Assign tasks to agents whose specialties match
- Agents on the same team collaborate: each agent sees what prior agents produced
- Tasks are dispatched immediately — agents start working in the background

Communication style:
- Professional and action-oriented
- Report what you DID, not what you "would" do
- Use tools first, then summarize the results
- NEVER write code or produce deliverables yourself — that's what your agents are for
- When agents report back, relay their results to the user

You are the owner's right hand. Delegate, orchestrate, and deliver results through your workforce.`;
    }

    return `You are ${this.agent.name}, a specialized autonomous AI agent in a collaborative workforce.

Role: ${this.agent.role}
Specialties: ${this.agent.specialty.join(', ')}

You are part of an AI team managed by a Main Agent (Atlas). You receive tasks and messages and must ACT on them independently using your tools.

## CRITICAL: You MUST use your tools to produce real work

You have the following tools — USE THEM, don't just describe what you'd do:

- **create_file**: Create or update actual project files (code, configs, docs). ALWAYS use this when asked to write code, create documents, or produce any deliverable. The file will be saved to the platform and visible to the user.
- **update_task_status**: Update your task's status and progress. Call this with status "in_progress" when you start working, and "completed" when done.
- **send_message**: Send messages to other agents for collaboration.
- **search_web**: Search the internet for information.
- **fetch_url**: Read content from a URL.
- **store_memory**: Save important facts for future recall.
- **recall_memory**: Search your long-term memory.
- **execute_code**: Run Python, JavaScript, or Bash code in a sandbox.
- **browse_web**: Navigate to a URL in a headless browser and get a screenshot for visual analysis.
- **browser_click**: Click an element on the current page by CSS selector.
- **browser_type**: Type text into an input field on the page.
- **browser_screenshot**: Take a screenshot of the current browser page.

## How you work:
1. Read the task/message carefully
2. If the task asks you to create something — call **create_file** with the actual content
3. If the task asks you to research — call **search_web** and **fetch_url**
4. If other team members have contributed (shown under "Prior Team Member Contributions"), BUILD ON their work
5. Update your task status using **update_task_status** as you progress
6. Produce REAL output by calling tools — never just describe what you'd do

## IMPORTANT RULES:
- NEVER say "I would create..." or "Here's what I'd write..." — actually CREATE the file using create_file
- NEVER say "I would search for..." — actually SEARCH using search_web
- When asked to write code, use create_file to save it as a real file
- When asked to analyze something, do the analysis and save results with create_file
- Always update_task_status to "completed" with progress 100 when you finish a task
- You are a REAL autonomous agent with REAL tools. ACT, don't narrate.${this.agent.personality ? `\n\n## Your Personality\n${this.agent.personality}` : ''}`;
  }

  private async getToolDefinitions(): Promise<Anthropic.Tool[]> {
    const tools: Anthropic.Tool[] = [
      {
        name: 'send_message',
        description: 'Send a message to another agent or team',
        input_schema: {
          type: 'object' as const,
          properties: {
            to: {
              type: 'array',
              items: { type: 'string' },
              description: 'Agent or team IDs to send to',
            },
            message: { type: 'string', description: 'Message content' },
          },
          required: ['to', 'message'],
        },
      },
      {
        name: 'update_task_status',
        description: 'Update the status and progress of a task',
        input_schema: {
          type: 'object' as const,
          properties: {
            taskId: { type: 'string', description: 'The task ID to update' },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed', 'failed'],
              description: 'New task status',
            },
            progress: {
              type: 'number',
              description: 'Progress percentage (0-100)',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'request_help',
        description: 'Request help from the main agent or another agent',
        input_schema: {
          type: 'object' as const,
          properties: {
            issue: { type: 'string', description: 'Description of the issue' },
            context: {
              type: 'string',
              description: 'Additional context',
            },
          },
          required: ['issue'],
        },
      },
      {
        name: 'search_web',
        description: 'Search the internet for information using Brave Search API',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Search query' },
            count: { type: 'number', description: 'Number of results (1-10, default 5)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'fetch_url',
        description: 'Fetch and read the text content of a URL',
        input_schema: {
          type: 'object' as const,
          properties: {
            url: { type: 'string', description: 'The URL to fetch' },
          },
          required: ['url'],
        },
      },
      {
        name: 'notify_channel',
        description: 'Send a notification to Slack and/or Discord channels configured in user settings',
        input_schema: {
          type: 'object' as const,
          properties: {
            message: { type: 'string', description: 'Notification message' },
            channel: {
              type: 'string',
              enum: ['slack', 'discord', 'all'],
              description: 'Which channel(s) to notify (default: all)',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'schedule_task',
        description: 'Schedule a task to run at a future time or on a recurring schedule',
        input_schema: {
          type: 'object' as const,
          properties: {
            title: { type: 'string', description: 'Task title' },
            description: { type: 'string', description: 'Task description' },
            schedule: {
              type: 'string',
              description: 'ISO 8601 datetime for one-time (e.g. "2026-03-01T09:00:00Z") OR cron expression for recurring (e.g. "0 9 * * 1" = Monday 9am)',
            },
            type: {
              type: 'string',
              enum: ['once', 'cron'],
              description: 'Schedule type: once (run at specific time) or cron (recurring)',
            },
          },
          required: ['title', 'description', 'schedule', 'type'],
        },
      },
      {
        name: 'recall_memory',
        description: 'Search your long-term memory for relevant past knowledge and experiences',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'What to search for in memory' },
            limit: { type: 'number', description: 'Max results to return (default 5)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'store_memory',
        description: 'Store an important fact, learning, or insight in long-term memory for future recall',
        input_schema: {
          type: 'object' as const,
          properties: {
            content: { type: 'string', description: 'The information to remember' },
            importance: { type: 'number', description: 'Importance score 1-10 (default 5). Higher = recalled more often' },
          },
          required: ['content'],
        },
      },
      {
        name: 'execute_code',
        description: 'Execute code in a sandboxed Docker container. Supports Python, JavaScript, and Bash. Requires user permission.',
        input_schema: {
          type: 'object' as const,
          properties: {
            language: {
              type: 'string',
              enum: ['python', 'javascript', 'bash'],
              description: 'Programming language to execute',
            },
            code: { type: 'string', description: 'The code to execute' },
            description: { type: 'string', description: 'Brief description of what this code does (for audit log)' },
          },
          required: ['language', 'code'],
        },
      },
      {
        name: 'browse_web',
        description: 'Navigate to a URL in a headless browser and take a screenshot. The screenshot is returned as a base64 JPEG image for visual analysis. Requires browser_access permission.',
        input_schema: {
          type: 'object' as const,
          properties: {
            url: { type: 'string', description: 'The URL to navigate to' },
            tabId: { type: 'string', description: 'Optional tab ID to reuse an existing tab' },
          },
          required: ['url'],
        },
      },
      {
        name: 'browser_click',
        description: 'Click an element on the current browser page by CSS selector. Returns a screenshot after clicking. Requires browser_access permission.',
        input_schema: {
          type: 'object' as const,
          properties: {
            selector: { type: 'string', description: 'CSS selector of the element to click (e.g. "button.submit", "#login")' },
            tabId: { type: 'string', description: 'Optional tab ID' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'browser_type',
        description: 'Type text into an input field on the current browser page. Returns a screenshot after typing. Requires browser_access permission.',
        input_schema: {
          type: 'object' as const,
          properties: {
            selector: { type: 'string', description: 'CSS selector of the input element' },
            text: { type: 'string', description: 'Text to type into the input' },
            tabId: { type: 'string', description: 'Optional tab ID' },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'browser_screenshot',
        description: 'Take a screenshot of the current browser page. Requires browser_access permission.',
        input_schema: {
          type: 'object' as const,
          properties: {
            tabId: { type: 'string', description: 'Optional tab ID' },
          },
        },
      },
    ];

    // Main agent gets full orchestration tools
    if (this.agent.isMainAgent) {
      tools.push(
        {
          name: 'create_team',
          description: 'Create a new team. Returns the created team with its ID.',
          input_schema: {
            type: 'object' as const,
            properties: {
              name: { type: 'string', description: 'Team name' },
              goal: { type: 'string', description: 'What this team aims to achieve' },
              description: { type: 'string', description: 'Team description' },
            },
            required: ['name', 'goal'],
          },
        },
        {
          name: 'create_agent',
          description: 'Create a new AI agent and add it to the workforce. Returns the created agent with its ID.',
          input_schema: {
            type: 'object' as const,
            properties: {
              name: { type: 'string', description: 'Agent name (e.g. "Luna", "Kai")' },
              role: {
                type: 'string',
                description: 'Agent role (e.g. "researcher", "developer", "writer", "analyst", "designer")',
              },
              specialty: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of specialties (e.g. ["React", "TypeScript", "UI/UX"])',
              },
              teamId: {
                type: 'string',
                description: 'Optional team ID to add the agent to immediately',
              },
              personality: {
                type: 'string',
                description: 'Optional personality/tone for the agent (e.g. "concise, code-first, no fluff")',
              },
            },
            required: ['name', 'role', 'specialty'],
          },
        },
        {
          name: 'add_agent_to_team',
          description: 'Add an existing agent to a team',
          input_schema: {
            type: 'object' as const,
            properties: {
              agentId: { type: 'string', description: 'The agent ID' },
              teamId: { type: 'string', description: 'The team ID' },
            },
            required: ['agentId', 'teamId'],
          },
        },
        {
          name: 'create_task',
          description: 'Create a new task and optionally assign it to agents',
          input_schema: {
            type: 'object' as const,
            properties: {
              title: { type: 'string', description: 'Task title' },
              description: { type: 'string', description: 'Detailed task description' },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high', 'critical'],
                description: 'Task priority',
              },
              assignTo: {
                type: 'array',
                items: { type: 'string' },
                description: 'Agent IDs to assign this task to',
              },
              teamId: {
                type: 'string',
                description: 'Optional team ID this task belongs to',
              },
            },
            required: ['title', 'description'],
          },
        },
        {
          name: 'assign_task',
          description: 'Assign an existing task to an agent',
          input_schema: {
            type: 'object' as const,
            properties: {
              taskId: { type: 'string', description: 'The task ID' },
              agentId: { type: 'string', description: 'The agent ID to assign' },
            },
            required: ['taskId', 'agentId'],
          },
        },
        {
          name: 'list_agents',
          description: 'List all agents in the workforce',
          input_schema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'list_teams',
          description: 'List all teams',
          input_schema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'create_file',
          description: 'Create or update a project file. Use this to produce actual code, configs, docs, etc.',
          input_schema: {
            type: 'object' as const,
            properties: {
              path: {
                type: 'string',
                description: 'File path like "smart-calculator/src/App.tsx" or "project/README.md"',
              },
              content: { type: 'string', description: 'Full file content' },
              language: {
                type: 'string',
                description: 'Programming language (tsx, ts, py, js, css, html, md, json, etc.)',
              },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'list_files',
          description: 'List all project files, optionally filtered by path prefix',
          input_schema: {
            type: 'object' as const,
            properties: {
              prefix: { type: 'string', description: 'Optional path prefix filter (e.g. "smart-calculator/src/")' },
            },
          },
        },
        {
          name: 'create_organization',
          description: 'Create a top-level organization to group departments and teams',
          input_schema: {
            type: 'object' as const,
            properties: {
              name: { type: 'string', description: 'Organization name' },
              description: { type: 'string', description: 'What this organization does' },
            },
            required: ['name'],
          },
        },
        {
          name: 'create_department',
          description: 'Create a department within an organization',
          input_schema: {
            type: 'object' as const,
            properties: {
              organizationId: { type: 'string', description: 'Organization UUID' },
              name: { type: 'string', description: 'Department name' },
              description: { type: 'string', description: 'Department description' },
            },
            required: ['organizationId', 'name'],
          },
        },
        {
          name: 'assign_team_to_department',
          description: 'Assign a team to a department in the org hierarchy',
          input_schema: {
            type: 'object' as const,
            properties: {
              teamId: { type: 'string', description: 'Team UUID' },
              departmentId: { type: 'string', description: 'Department UUID' },
            },
            required: ['teamId', 'departmentId'],
          },
        },
      );
    }

    // Non-main agents also get file creation tools
    if (!this.agent.isMainAgent) {
      tools.push({
        name: 'create_file',
        description: 'Create or update a project file. Produce actual code, configs, docs.',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: {
              type: 'string',
              description: 'File path like "project/src/index.ts"',
            },
            content: { type: 'string', description: 'Full file content' },
            language: {
              type: 'string',
              description: 'Language: tsx, ts, py, js, css, html, md, json, etc.',
            },
          },
          required: ['path', 'content'],
        },
      });
    }

    // Dynamic skill injection — append enabled skills as tools
    try {
      const skills = await this.skillService.getSkillsForAgent(this.agent.id);
      for (const skill of skills) {
        const toolDef = skill.toolDefinition as Record<string, unknown>;
        tools.push({
          name: toolDef.name as string,
          description: (toolDef.description as string) || skill.description,
          input_schema: (toolDef.input_schema as Anthropic.Tool.InputSchema) || {
            type: 'object' as const,
            properties: {},
          },
        });
      }
    } catch (err) {
      logger.warn('Failed to load skills for agent', { agentId: this.agent.id, error: (err as Error).message });
    }

    // Dynamic integration injection — append connected integrations as tools
    try {
      const userConnections = await this.db.userIntegration.findMany({
        where: { userId: this.agent.userId, status: 'connected' },
        include: { integration: true },
      });

      for (const conn of userConnections) {
        const integration = conn.integration;
        const actions = integration.actions as Array<{ name: string; label: string; description: string }>;

        for (const action of actions) {
          const toolName = `integration_${integration.slug}_${action.name}`;
          tools.push({
            name: toolName,
            description: `[${integration.name}] ${action.description}`,
            input_schema: {
              type: 'object' as const,
              properties: {
                input: {
                  type: 'object' as const,
                  description: `Input parameters for the ${action.label} action on ${integration.name}. Provide relevant fields as key-value pairs.`,
                },
              },
            },
          });
        }
      }
    } catch (err) {
      logger.warn('Failed to load integrations for agent', { agentId: this.agent.id, error: (err as Error).message });
    }

    return tools;
  }

  /**
   * Execute a tool call against real platform services.
   */
  private async executeTool(
    name: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const userId = this.agent.userId;

    logger.info('Agent executing tool', {
      agentId: this.agent.id,
      tool: name,
      input,
    });

    emitToUser(userId, 'agent:tool_use', {
      agentId: this.agent.id,
      agentName: this.agent.name,
      tool: name,
      input,
    });

    try {
      switch (name) {
        // ----- Orchestration tools (main agent) -----

        case 'create_team': {
          // Check if team with this name already exists
          const existingTeam = await this.db.team.findFirst({
            where: { userId, name: input.name as string },
          });
          if (existingTeam) {
            return {
              success: true,
              teamId: existingTeam.id,
              name: existingTeam.name,
              alreadyExisted: true,
              message: `Team "${existingTeam.name}" already exists. Use their ID: ${existingTeam.id}`,
            };
          }

          const team = await this.teamService.create(userId, {
            name: input.name as string,
            goal: input.goal as string,
            description: (input.description as string) ?? '',
          });
          emitToUser(userId, 'team:created', team);
          await this.auditService.log({
            agentId: this.agent.id,
            action: 'create_team',
            parameters: { name: team.name },
            result: { teamId: team.id },
            success: true,
          });
          return { success: true, teamId: team.id, name: team.name };
        }

        case 'create_agent': {
          // Check if agent with this name already exists for this user
          const existingAgent = await this.db.agent.findFirst({
            where: { userId, name: input.name as string },
          });
          if (existingAgent) {
            return {
              success: true,
              agentId: existingAgent.id,
              name: existingAgent.name,
              role: existingAgent.role,
              alreadyExisted: true,
              message: `Agent "${existingAgent.name}" already exists. Use their ID: ${existingAgent.id}`,
            };
          }

          const agent = await this.agentService.create(userId, {
            name: input.name as string,
            role: input.role as string,
            specialty: input.specialty as string[],
            teamId: input.teamId as string | undefined,
            personality: input.personality as string | undefined,
          });
          emitToUser(userId, 'agent:created', agent);
          await this.auditService.log({
            agentId: this.agent.id,
            action: 'create_agent',
            parameters: { name: agent.name, role: agent.role },
            result: { agentId: agent.id },
            success: true,
          });
          return { success: true, agentId: agent.id, name: agent.name, role: agent.role };
        }

        case 'add_agent_to_team': {
          if (!isValidUuid(input.agentId) || !isValidUuid(input.teamId)) {
            return { error: 'Invalid agentId or teamId. Use UUIDs from create_agent/create_team results.' };
          }
          await this.teamService.addAgent(userId, input.teamId, input.agentId);
          emitToUser(userId, 'team:updated', { teamId: input.teamId });
          return { success: true, agentId: input.agentId, teamId: input.teamId };
        }

        case 'create_task': {
          const rawAssignTo = input.assignTo as string[] | undefined;
          const assignTo = rawAssignTo?.filter(isValidUuid);
          if (input.teamId && !isValidUuid(input.teamId)) {
            return { error: 'Invalid teamId. Use the UUID from create_team result.' };
          }
          const task = await this.taskService.create(
            userId,
            {
              title: input.title as string,
              description: input.description as string,
              priority: (input.priority as TaskPriority) ?? 'medium',
              assignTo,
              teamId: input.teamId as string | undefined,
            },
            this.agent.id,
          );
          // Fetch enriched task with team/agent details for the frontend
          const enrichedTask = await this.taskService.findById(userId, task.id);
          emitToUser(userId, 'task:created', enrichedTask);
          await this.auditService.log({
            agentId: this.agent.id,
            action: 'create_task',
            parameters: { title: task.title },
            result: { taskId: task.id },
            success: true,
          });

          // Fire-and-forget: dispatch agents to work on this task autonomously
          if (assignTo && assignTo.length > 0) {
            this.taskDispatcher.dispatch(task.id, userId).catch((err) => {
              logger.error('Task dispatch failed', { taskId: task.id, error: (err as Error).message });
            });
          }

          return {
            success: true,
            taskId: task.id,
            title: task.title,
            dispatched: !!(assignTo && assignTo.length > 0),
            message: assignTo && assignTo.length > 0
              ? 'Task created and dispatched to agents. They will work on it autonomously and report back when done.'
              : 'Task created but no agents assigned yet.',
          };
        }

        case 'assign_task': {
          if (!isValidUuid(input.taskId) || !isValidUuid(input.agentId)) {
            return { error: 'Invalid taskId or agentId. Use UUIDs from create_task/create_agent results.' };
          }
          await this.taskService.assignAgent(userId, input.taskId, input.agentId);

          // Emit enriched task so the frontend sees the new assignment
          const assignedTask = await this.taskService.findById(userId, input.taskId as string);
          emitToUser(userId, 'task:updated', assignedTask);

          // Dispatch the task now that an agent is assigned
          this.taskDispatcher.dispatch(input.taskId as string, userId).catch((err) => {
            logger.error('Task dispatch failed', { taskId: input.taskId, error: (err as Error).message });
          });

          return {
            success: true,
            taskId: input.taskId,
            agentId: input.agentId,
            message: 'Agent assigned and task dispatched. The agent will work on it autonomously.',
          };
        }

        case 'update_task_status': {
          if (!isValidUuid(input.taskId)) {
            return { error: 'Invalid taskId. Use the UUID from create_task result.' };
          }
          const updated = await this.taskService.update(
            userId,
            input.taskId,
            {
              ...(input.status ? { status: input.status as TaskStatus } : {}),
              ...(input.progress !== undefined ? { progress: input.progress as number } : {}),
            },
          );
          emitToUser(userId, 'task:update', {
            taskId: updated.id,
            status: updated.status,
            progress: updated.progress,
          });
          return { success: true, taskId: updated.id, status: updated.status };
        }

        case 'list_agents': {
          const result = await this.agentService.findAll(userId, { page: 1, limit: 50 });
          const agents = result.data.map((a) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            specialty: a.specialty,
            status: a.status,
            teamId: a.teamId,
            isMainAgent: a.isMainAgent,
          }));
          return { agents, total: agents.length };
        }

        case 'list_teams': {
          const result = await this.teamService.findAll(userId, { page: 1, limit: 50 });
          const teams = result.data.map((t) => ({
            id: t.id,
            name: t.name,
            goal: t.goal,
            status: t.status,
          }));
          return { teams, total: teams.length };
        }

        // ----- Common tools -----

        case 'send_message': {
          const recipients = (input.to as string[]).filter(isValidUuid);
          if (recipients.length === 0) {
            return { error: 'No valid recipient UUIDs. Use agent IDs from list_agents.' };
          }
          await this.messageService.send(
            { to: recipients, type: 'direct', content: input.message as string },
            { fromAgentId: this.agent.id },
          );

          // Trigger recipient agents to process and respond
          for (const recipientId of recipients) {
            const recipientRecord = await this.db.agent.findFirst({
              where: { id: recipientId, isMainAgent: false, status: { not: 'offline' } },
            });
            if (recipientRecord) {
              const recipientDto: Agent = {
                id: recipientRecord.id,
                userId: recipientRecord.userId,
                teamId: recipientRecord.teamId,
                name: recipientRecord.name,
                role: recipientRecord.role,
                specialty: recipientRecord.specialty,
                status: recipientRecord.status as Agent['status'],
                isMainAgent: recipientRecord.isMainAgent,
                contextId: recipientRecord.contextId,
                currentTaskId: recipientRecord.currentTaskId,
                capabilities: recipientRecord.capabilities,
                personality: (recipientRecord as any).personality ?? null,
                modelProvider: (recipientRecord as any).modelProvider ?? 'anthropic',
                modelName: (recipientRecord as any).modelName ?? null,
                createdAt: recipientRecord.createdAt,
                lastActive: recipientRecord.lastActive,
                lastSyncAt: recipientRecord.lastSyncAt,
                stats: recipientRecord.stats as any,
              };
              // Fire-and-forget: let the recipient process asynchronously
              const recipientRuntime = new AgentRuntime(recipientDto, env.ANTHROPIC_API_KEY);

              // Notify user that the recipient agent is processing
              emitToUser(recipientRecord.userId, 'agent:message', {
                id: `agent-processing-${Date.now()}-${recipientId}`,
                agentId: recipientId,
                agentName: recipientRecord.name,
                content: `*Processing message from ${this.agent.name}...*`,
                timestamp: new Date().toISOString(),
              });

              recipientRuntime
                .processMessage(input.message as string, `Agent ${this.agent.name}`)
                .then(async (reply) => {
                  await this.messageService.send(
                    { to: [], type: 'direct', content: reply },
                    { fromAgentId: recipientId },
                  );
                  emitToUser(recipientRecord.userId, 'agent:message', {
                    id: `agent-reply-${Date.now()}-${recipientId}`,
                    agentId: recipientId,
                    agentName: recipientRecord.name,
                    content: reply,
                    timestamp: new Date().toISOString(),
                  });
                })
                .catch((err) => {
                  logger.error('Agent-to-agent reply failed', {
                    from: this.agent.id,
                    to: recipientId,
                    error: (err as Error).message,
                    stack: (err as Error).stack,
                  });
                  // Emit error to user so they can see what went wrong
                  emitToUser(recipientRecord.userId, 'agent:message', {
                    id: `agent-error-${Date.now()}-${recipientId}`,
                    agentId: recipientId,
                    agentName: recipientRecord.name,
                    content: `Failed to process message: ${(err as Error).message}`,
                    timestamp: new Date().toISOString(),
                  });
                });
            }
          }

          return { sent: true, to: recipients };
        }

        // ----- File tools -----

        case 'create_file': {
          const filePath = input.path as string;
          if (!filePath || filePath.trim() === '') {
            return { error: 'File path is required.' };
          }
          const file = await this.fileService.createFile(userId, {
            path: filePath,
            content: input.content as string,
            language: input.language as string | undefined,
            agentId: this.agent.id,
          });
          emitToUser(userId, 'file:created', { fileId: file.id, path: file.path });
          return { success: true, fileId: file.id, path: file.path, size: file.size };
        }

        case 'list_files': {
          const result = await this.fileService.listFiles(userId, input.prefix as string | undefined);
          const files = result.data.map((f) => ({
            id: f.id,
            path: f.path,
            language: f.language,
            size: f.size,
          }));
          return { files, total: files.length };
        }

        // ----- Organization tools -----

        case 'create_organization': {
          const orgName = input.name as string;
          // Check if org already exists
          const existingOrg = await this.db.organization.findFirst({
            where: { userId, name: orgName },
          });
          if (existingOrg) {
            return {
              success: true,
              organizationId: existingOrg.id,
              name: existingOrg.name,
              alreadyExisted: true,
              message: `Organization "${existingOrg.name}" already exists. Use ID: ${existingOrg.id}`,
            };
          }
          const org = await this.organizationService.create(userId, {
            name: orgName,
            description: input.description as string | undefined,
          });
          emitToUser(userId, 'organization:created', org);
          return { success: true, organizationId: org.id, name: org.name };
        }

        case 'create_department': {
          if (!isValidUuid(input.organizationId)) {
            return { error: 'Invalid organizationId. Use the UUID from create_organization result.' };
          }
          const deptName = input.name as string;
          // Check if department already exists in this org
          const existingDept = await this.db.department.findFirst({
            where: { organizationId: input.organizationId as string, name: deptName },
          });
          if (existingDept) {
            return {
              success: true,
              departmentId: existingDept.id,
              name: existingDept.name,
              alreadyExisted: true,
              message: `Department "${existingDept.name}" already exists. Use ID: ${existingDept.id}`,
            };
          }
          const dept = await this.departmentService.create(
            userId,
            input.organizationId as string,
            { name: deptName, description: input.description as string | undefined },
          );
          emitToUser(userId, 'department:created', dept);
          return { success: true, departmentId: dept.id, name: dept.name };
        }

        case 'assign_team_to_department': {
          if (!isValidUuid(input.teamId) || !isValidUuid(input.departmentId)) {
            return { error: 'Invalid teamId or departmentId. Use UUIDs from earlier results.' };
          }
          // Find the department to get the orgId
          const dept = await this.db.department.findUnique({
            where: { id: input.departmentId as string },
          });
          if (!dept) {
            return { error: `Department ${input.departmentId} not found.` };
          }
          await this.departmentService.addTeam(
            dept.organizationId,
            input.departmentId as string,
            input.teamId as string,
          );
          emitToUser(userId, 'team:updated', { teamId: input.teamId });
          return {
            success: true,
            teamId: input.teamId,
            departmentId: input.departmentId,
            message: 'Team assigned to department.',
          };
        }

        case 'request_help':
          return { requested: true, issue: input.issue };

        // ----- Web & Notification tools -----

        case 'search_web': {
          const apiKey = (this.userSettings.braveApiKey as string) || env.BRAVE_SEARCH_API_KEY || '';
          const results = await this.webService.searchWeb(
            input.query as string,
            apiKey,
            (input.count as number) ?? 5,
          );
          await this.auditService.log({
            agentId: this.agent.id,
            action: 'search_web',
            parameters: { query: input.query },
            result: { count: results.length },
            success: true,
          });
          return { results, count: results.length };
        }

        case 'fetch_url': {
          const content = await this.webService.fetchUrl(input.url as string);
          await this.auditService.log({
            agentId: this.agent.id,
            action: 'fetch_url',
            parameters: { url: input.url },
            result: { contentLength: content.length },
            success: true,
          });
          return { content, url: input.url };
        }

        case 'notify_channel': {
          const result = await this.notificationService.notify(
            this.userSettings,
            input.message as string,
            (input.channel as string) ?? 'all',
          );
          await this.auditService.log({
            agentId: this.agent.id,
            action: 'notify_channel',
            parameters: { channel: input.channel ?? 'all' },
            result: { ...result },
            success: true,
          });
          return result;
        }

        // ----- Scheduling & Memory tools -----

        case 'schedule_task': {
          const schedType = input.type as 'once' | 'cron';
          let scheduled;
          if (schedType === 'once') {
            scheduled = await this.schedulerService.scheduleOnce(
              userId,
              this.agent.id,
              input.title as string,
              input.description as string,
              new Date(input.schedule as string),
            );
          } else {
            scheduled = await this.schedulerService.scheduleCron(
              userId,
              this.agent.id,
              input.title as string,
              input.description as string,
              input.schedule as string,
            );
          }
          await this.auditService.log({
            agentId: this.agent.id,
            action: 'schedule_task',
            parameters: { title: input.title, type: schedType, schedule: input.schedule },
            result: { scheduledTaskId: scheduled.id },
            success: true,
          });
          return { success: true, scheduledTaskId: scheduled.id, type: schedType, schedule: input.schedule };
        }

        case 'recall_memory': {
          const memories = await this.memoryService.searchMemory(
            this.agent.id,
            input.query as string,
            (input.limit as number) ?? 5,
          );
          return {
            memories: memories.map((m) => ({ content: m.content, type: m.type, importance: m.importance })),
            count: memories.length,
          };
        }

        case 'store_memory': {
          const mem = await this.memoryService.addMemory(
            this.agent.id,
            input.content as string,
            'fact',
            (input.importance as number) ?? 5,
          );
          return { success: true, memoryId: mem.id };
        }

        case 'browse_web':
        case 'browser_click':
        case 'browser_type':
        case 'browser_screenshot': {
          // Permission gate: browser access requires explicit user approval
          const hasBrowserPerm = await this.permissionService.hasPermission(
            this.agent.id,
            'browser_access',
            '*',
          );
          if (!hasBrowserPerm) {
            await this.permissionService.requestPermission({
              agentId: this.agent.id,
              permissionType: 'browser_access' as PermissionType,
              scope: '*',
              duration: 'session' as PermissionDuration,
            });
            emitToUser(userId, 'permission:request', {
              agentId: this.agent.id,
              agentName: this.agent.name,
              type: 'browser_access',
            });
            return { error: 'Browser access requires user permission. A request has been submitted. Please approve it in the Permissions panel.' };
          }

          emitToUser(userId, 'agent:tool_use', {
            agentId: this.agent.id,
            agentName: this.agent.name,
            tool: name,
            input,
          });

          try {
            let browserResult;
            switch (name) {
              case 'browse_web':
                browserResult = await this.browserService.navigateAndScreenshot(
                  input.url as string,
                  input.tabId as string | undefined,
                );
                break;
              case 'browser_click':
                browserResult = await this.browserService.click(
                  input.selector as string,
                  input.tabId as string | undefined,
                );
                break;
              case 'browser_type':
                browserResult = await this.browserService.type(
                  input.selector as string,
                  input.text as string,
                  input.tabId as string | undefined,
                );
                break;
              case 'browser_screenshot':
                browserResult = await this.browserService.screenshot(
                  input.tabId as string | undefined,
                );
                break;
            }

            await this.auditService.log({
              agentId: this.agent.id,
              action: name,
              parameters: input as Record<string, unknown>,
              result: { title: browserResult!.title, url: browserResult!.url },
              success: true,
            });

            return {
              title: browserResult!.title,
              url: browserResult!.url,
              screenshot: browserResult!.screenshot,
              screenshotFormat: 'base64 JPEG',
            };
          } catch (err) {
            const errorMsg = (err as Error).message;
            await this.auditService.log({
              agentId: this.agent.id,
              action: name,
              parameters: input as Record<string, unknown>,
              result: { error: errorMsg },
              success: false,
            });
            return { error: `Browser action failed: ${errorMsg}` };
          }
        }

        case 'execute_code': {
          // Permission gate: code execution requires explicit user approval
          const hasCodePerm = await this.permissionService.hasPermission(
            this.agent.id,
            'code_execution',
            '*',
          );
          if (!hasCodePerm) {
            await this.permissionService.requestPermission({
              agentId: this.agent.id,
              permissionType: 'execute_shell' as PermissionType,
              scope: '*',
              duration: 'session' as PermissionDuration,
            });
            emitToUser(userId, 'permission:request', {
              agentId: this.agent.id,
              agentName: this.agent.name,
              type: 'code_execution',
            });
            return { error: 'Code execution requires user permission. A request has been submitted. Please approve it in the Permissions panel.' };
          }

          const dockerAvailable = await this.sandboxService.isDockerAvailable();
          if (!dockerAvailable) {
            return { error: 'Docker is not available. Please ensure Docker Desktop is running.' };
          }

          const execResult = await this.sandboxService.executeCode(
            input.language as 'python' | 'javascript' | 'bash',
            input.code as string,
            30000,
          );
          await this.auditService.log({
            agentId: this.agent.id,
            action: 'execute_code',
            parameters: { language: input.language, description: input.description },
            result: { exitCode: execResult.exitCode, timedOut: execResult.timedOut },
            success: execResult.exitCode === 0,
          });
          return execResult;
        }

        default: {
          // Check if tool name matches a connected integration action (integration_<slug>_<action>)
          if (name.startsWith('integration_')) {
            // Format: integration_<slug>_<actionName> — find matching connected integration
            const userConnections = await this.db.userIntegration.findMany({
              where: { userId, status: 'connected' },
              include: { integration: true },
            });

            for (const conn of userConnections) {
              const prefix = `integration_${conn.integration.slug}_`;
              if (name.startsWith(prefix)) {
                const actionName = name.slice(prefix.length);
                const actionInput = (input.input as Record<string, unknown>) || input;
                const result = await this.integrationExecutor.executeAction(
                  userId,
                  conn.integrationId,
                  actionName,
                  actionInput,
                );
                await this.auditService.log({
                  agentId: this.agent.id,
                  action: 'execute_integration',
                  parameters: { integration: conn.integration.name, actionName, input: actionInput },
                  result: result as unknown as Record<string, unknown>,
                  success: result.success,
                });
                return result;
              }
            }
          }

          // Check if tool name matches an enabled skill
          const skills = await this.skillService.getSkillsForAgent(this.agent.id);
          const matchedSkill = skills.find(
            (s) => (s.toolDefinition as Record<string, unknown>).name === name,
          );
          if (matchedSkill) {
            const skillResult = await this.skillService.executeSkill(matchedSkill.id, input);
            await this.auditService.log({
              agentId: this.agent.id,
              action: 'execute_skill',
              parameters: { skillName: matchedSkill.name, input },
              result: { skillResult },
              success: true,
            });
            return skillResult;
          }
          return { error: `Unknown tool: ${name}` };
        }
      }
    } catch (error) {
      logger.error('Tool execution failed', {
        agentId: this.agent.id,
        tool: name,
        error: (error as Error).message,
      });
      return { error: (error as Error).message };
    }
  }

  private async loadContext(): Promise<{
    conversationHistory: Record<string, unknown>[];
    knowledgeBase: Record<string, unknown>;
    workingMemory: Record<string, unknown>;
  }> {
    const ctx = await this.db.agentContext.findUnique({
      where: { agentId: this.agent.id },
    });

    if (!ctx) {
      return { conversationHistory: [], knowledgeBase: {}, workingMemory: {} };
    }

    return {
      conversationHistory: ctx.conversationHistory as Record<string, unknown>[],
      knowledgeBase: ctx.knowledgeBase as Record<string, unknown>,
      workingMemory: ctx.workingMemory as Record<string, unknown>,
    };
  }

  private async appendToContext(entry: Record<string, unknown>): Promise<void> {
    const ctx = await this.loadContext();
    const history = [...ctx.conversationHistory, entry];

    // Keep last 50 conversation entries to manage context window
    const trimmed = history.slice(-50);

    await this.db.agentContext.upsert({
      where: { agentId: this.agent.id },
      create: {
        agentId: this.agent.id,
        conversationHistory: trimmed as unknown as Prisma.InputJsonValue,
      },
      update: {
        conversationHistory: trimmed as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
  }

  private formatConversationHistory(
    history: Record<string, unknown>[],
  ): Anthropic.MessageParam[] {
    return history
      .filter((h) => h.role === 'user' || h.role === 'assistant')
      .map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: (h.content as string) || '',
      }));
  }

  private async updateStatus(status: string): Promise<void> {
    await this.db.agent.update({
      where: { id: this.agent.id },
      data: { status, lastActive: new Date() },
    });

    emitToUser(this.agent.userId, 'agent:status', {
      agentId: this.agent.id,
      status,
    });
  }
}
