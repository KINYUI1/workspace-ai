import { useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Clock, Brain, Wrench } from 'lucide-react';

import type { ToolUseEvent } from '@/stores/chat.store';

interface StreamingMessageProps {
  agentName: string | null;
  text: string;
  thinking: string;
  tools: ToolUseEvent[];
  usage: { inputTokens: number; outputTokens: number } | null;
}

export function StreamingMessage({ agentName, text, thinking, tools, usage }: StreamingMessageProps) {
  const [showThinking, setShowThinking] = useState(false);

  return (
    <div className="flex gap-3 py-3">
      {/* Agent avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600/20">
        <Bot size={16} className="text-primary-400" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {/* Agent name */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary-400">{agentName || 'Agent'}</span>
          <Loader2 size={12} className="animate-spin text-primary-400" />
        </div>

        {/* Thinking block */}
        {thinking && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300"
            >
              <Brain size={12} />
              {showThinking ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Thinking...
            </button>
            {showThinking && (
              <p className="mt-2 whitespace-pre-wrap text-xs text-amber-300/70 italic leading-relaxed">
                {thinking}
              </p>
            )}
          </div>
        )}

        {/* Tool use cards */}
        {tools.map((tool) => (
          <ToolCard key={tool.toolId} tool={tool} />
        ))}

        {/* Streamed text with blinking cursor */}
        {text && (
          <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {text}
            <span className="inline-block w-0.5 h-4 bg-primary-400 ml-0.5 animate-pulse align-text-bottom" />
          </div>
        )}

        {/* Empty state while waiting for first token */}
        {!text && !thinking && tools.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 size={14} className="animate-spin" />
            Generating response...
          </div>
        )}

        {/* Usage display */}
        {usage && (
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span>{usage.inputTokens.toLocaleString()} in</span>
            <span>{usage.outputTokens.toLocaleString()} out</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolUseEvent }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = tool.status === 'running' ? (
    <Loader2 size={12} className="animate-spin text-blue-400" />
  ) : tool.status === 'completed' ? (
    <CheckCircle2 size={12} className="text-green-400" />
  ) : (
    <XCircle size={12} className="text-red-400" />
  );

  const toolLabel = tool.toolName.replace(/_/g, ' ');

  return (
    <div className="rounded-lg border border-border bg-surface-light overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface transition-colors"
      >
        <Wrench size={12} className="text-text-secondary shrink-0" />
        <span className="text-xs font-medium text-text-primary flex-1 capitalize">{toolLabel}</span>
        {tool.durationMs != null && (
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <Clock size={10} />
            {tool.durationMs < 1000 ? `${tool.durationMs}ms` : `${(tool.durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
        {statusIcon}
        {expanded ? <ChevronDown size={12} className="text-text-secondary" /> : <ChevronRight size={12} className="text-text-secondary" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {/* Input */}
          <div>
            <span className="text-xs font-medium text-text-secondary">Input</span>
            <pre className="mt-1 text-xs text-text-primary bg-background rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {tool.result !== undefined && (
            <div>
              <span className="text-xs font-medium text-text-secondary">Output</span>
              <pre className="mt-1 text-xs text-text-primary bg-background rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
