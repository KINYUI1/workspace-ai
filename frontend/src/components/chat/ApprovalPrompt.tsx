import { useState } from 'react';
import { ShieldAlert, Check, X, ShieldCheck } from 'lucide-react';
import { api } from '@/services/api';

interface ApprovalPromptProps {
  approvalId: string;
  agentName: string;
  toolName: string;
  input: Record<string, unknown>;
  onResponded: () => void;
}

export function ApprovalPrompt({ approvalId, agentName, toolName, input, onResponded }: ApprovalPromptProps) {
  const [responding, setResponding] = useState(false);
  const [decided, setDecided] = useState<'approved' | 'denied' | null>(null);

  const toolLabel = toolName.replace(/_/g, ' ');

  const respond = async (decision: 'approved' | 'denied', alwaysAllow = false) => {
    setResponding(true);
    try {
      await api.respondToApproval(approvalId, decision, alwaysAllow);
      setDecided(decision);
      onResponded();
    } catch {
      // Silently fail — the timeout will handle it
    } finally {
      setResponding(false);
    }
  };

  if (decided) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-light px-3 py-2">
        {decided === 'approved' ? (
          <ShieldCheck size={14} className="text-green-400" />
        ) : (
          <ShieldAlert size={14} className="text-red-400" />
        )}
        <span className="text-xs text-text-secondary">
          {decided === 'approved' ? 'Approved' : 'Denied'}: {agentName} — {toolLabel}
        </span>
      </div>
    );
  }

  // Get a human-readable summary of what the agent wants to do
  const summary = getSummary(toolName, input);

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="text-amber-400 shrink-0" />
        <span className="text-xs font-medium text-amber-400">Approval Required</span>
      </div>

      <p className="text-sm text-text-primary">
        <strong>{agentName}</strong> wants to <span className="capitalize">{toolLabel}</span>
      </p>

      {summary && (
        <pre className="text-xs text-text-secondary bg-background rounded p-2 overflow-x-auto max-h-24 overflow-y-auto font-mono">
          {summary}
        </pre>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => respond('approved')}
          disabled={responding}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          <Check size={12} />
          Allow
        </button>
        <button
          onClick={() => respond('denied')}
          disabled={responding}
          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <X size={12} />
          Deny
        </button>
        <button
          onClick={() => respond('approved', true)}
          disabled={responding}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-light disabled:opacity-50"
        >
          <ShieldCheck size={12} />
          Always Allow
        </button>
      </div>
    </div>
  );
}

function getSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'execute_code':
      return `Language: ${input.language || 'unknown'}\n${(input.code as string || '').slice(0, 200)}`;
    case 'create_file':
      return `Path: ${input.path || 'unknown'}`;
    case 'navigate_browser':
      return `URL: ${input.url || 'unknown'}`;
    default:
      return JSON.stringify(input, null, 2).slice(0, 200);
  }
}
