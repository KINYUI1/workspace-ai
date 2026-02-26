import { useState } from 'react';
import {
  ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle,
  Clock, Wrench, FileText, Globe, Code, Send, Search, Database,
  FolderOpen, Bot, Users, ListTodo, Plug,
} from 'lucide-react';
import type { ToolUseEvent } from '@/stores/chat.store';

const TOOL_ICONS: Record<string, typeof Wrench> = {
  create_file: FileText,
  list_files: FolderOpen,
  read_file: FileText,
  search_web: Globe,
  fetch_url: Globe,
  execute_code: Code,
  send_message: Send,
  search_memory: Search,
  create_agent: Bot,
  list_agents: Bot,
  create_team: Users,
  list_teams: Users,
  create_task: ListTodo,
  assign_task: ListTodo,
  update_task_status: ListTodo,
  run_integration: Plug,
  navigate_browser: Globe,
  screenshot_browser: Globe,
  create_scheduled_task: Clock,
  search_knowledge: Database,
};

interface ToolCardProps {
  tool: ToolUseEvent;
  compact?: boolean;
}

export function ToolCard({ tool, compact = false }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);

  const Icon = TOOL_ICONS[tool.toolName] || Wrench;
  const toolLabel = tool.toolName.replace(/_/g, ' ');

  const statusIcon = tool.status === 'running' ? (
    <Loader2 size={12} className="animate-spin text-blue-400" />
  ) : tool.status === 'completed' ? (
    <CheckCircle2 size={12} className="text-green-400" />
  ) : (
    <XCircle size={12} className="text-red-400" />
  );

  const statusBg = tool.status === 'running'
    ? 'border-blue-500/20'
    : tool.status === 'completed'
      ? 'border-green-500/20'
      : 'border-red-500/20';

  // Summary line for the tool
  const summary = getToolSummary(tool);

  return (
    <div className={`rounded-lg border ${statusBg} bg-surface-light overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface transition-colors"
      >
        <Icon size={12} className="text-text-secondary shrink-0" />
        <span className="text-xs font-medium text-text-primary capitalize">{toolLabel}</span>
        {summary && !compact && (
          <span className="text-xs text-text-secondary truncate flex-1">{summary}</span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          {tool.durationMs != null && (
            <span className="flex items-center gap-0.5 text-xs text-text-secondary">
              <Clock size={10} />
              {tool.durationMs < 1000 ? `${tool.durationMs}ms` : `${(tool.durationMs / 1000).toFixed(1)}s`}
            </span>
          )}
          {statusIcon}
          {expanded ? <ChevronDown size={12} className="text-text-secondary" /> : <ChevronRight size={12} className="text-text-secondary" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {/* Input */}
          <div>
            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Input</span>
            <pre className="mt-1 text-xs text-text-primary bg-background rounded p-2 overflow-x-auto max-h-40 overflow-y-auto font-mono">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {tool.result !== undefined && (
            <div>
              <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Output</span>
              <pre className="mt-1 text-xs text-text-primary bg-background rounded p-2 overflow-x-auto max-h-40 overflow-y-auto font-mono">
                {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getToolSummary(tool: ToolUseEvent): string {
  const input = tool.input;
  switch (tool.toolName) {
    case 'create_file':
      return `${input.path || ''}`;
    case 'search_web':
      return `"${input.query || ''}"`;
    case 'fetch_url':
      return `${input.url || ''}`;
    case 'execute_code':
      return `${input.language || 'code'}`;
    case 'send_message':
      return 'to agent';
    case 'create_team':
      return `${input.name || ''}`;
    case 'create_agent':
      return `${input.name || ''}`;
    case 'create_task':
      return `${input.title || ''}`;
    case 'navigate_browser':
      return `${input.url || ''}`;
    default:
      return '';
  }
}
