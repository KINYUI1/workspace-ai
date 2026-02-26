import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { emitStreamEvent } from '../communication/websocket';

export interface ApprovalRequest {
  id: string;
  userId: string;
  agentId: string;
  agentName: string;
  toolName: string;
  input: Record<string, unknown>;
  status: 'pending' | 'approved' | 'denied' | 'timeout';
  createdAt: Date;
  resolvePromise?: (approved: boolean) => void;
}

// In-memory store for pending approvals
const pendingApprovals = new Map<string, ApprovalRequest>();

// Tools that always require approval before executing
const APPROVAL_REQUIRED_TOOLS = new Set([
  'execute_code',
]);

// Per-user allowlists (in-memory, could be persisted to DB)
const userAllowlists = new Map<string, Set<string>>();

const APPROVAL_TIMEOUT_MS = 60_000; // 60 seconds

/**
 * Check if a tool requires approval for the given user.
 */
export function requiresApproval(userId: string, toolName: string): boolean {
  // Check user allowlist first
  const allowlist = userAllowlists.get(userId);
  if (allowlist?.has(toolName)) return false;

  return APPROVAL_REQUIRED_TOOLS.has(toolName);
}

/**
 * Request approval from the user for a tool execution.
 * Returns a promise that resolves to true (approved) or false (denied/timeout).
 */
export async function requestApproval(
  userId: string,
  agentId: string,
  agentName: string,
  toolName: string,
  input: Record<string, unknown>,
): Promise<boolean> {
  const id = uuidv4();

  return new Promise<boolean>((resolve) => {
    const request: ApprovalRequest = {
      id,
      userId,
      agentId,
      agentName,
      toolName,
      input,
      status: 'pending',
      createdAt: new Date(),
      resolvePromise: resolve,
    };

    pendingApprovals.set(id, request);

    // Emit to user via Socket.io
    emitStreamEvent(userId, 'agent:approval:request', {
      approvalId: id,
      agentId,
      agentName,
      toolName,
      input,
    });

    logger.info('Approval requested', { approvalId: id, toolName, agentName });

    // Auto-timeout
    setTimeout(() => {
      const pending = pendingApprovals.get(id);
      if (pending && pending.status === 'pending') {
        pending.status = 'timeout';
        pendingApprovals.delete(id);
        resolve(false);
        logger.warn('Approval timed out', { approvalId: id, toolName });
      }
    }, APPROVAL_TIMEOUT_MS);
  });
}

/**
 * Respond to an approval request.
 */
export function respondToApproval(
  approvalId: string,
  decision: 'approved' | 'denied',
  alwaysAllow = false,
): boolean {
  const request = pendingApprovals.get(approvalId);
  if (!request || request.status !== 'pending') {
    return false;
  }

  request.status = decision;

  // If "always allow", add to user's allowlist
  if (decision === 'approved' && alwaysAllow) {
    if (!userAllowlists.has(request.userId)) {
      userAllowlists.set(request.userId, new Set());
    }
    userAllowlists.get(request.userId)!.add(request.toolName);
    logger.info('Added to user allowlist', {
      userId: request.userId,
      toolName: request.toolName,
    });
  }

  // Resolve the waiting promise
  if (request.resolvePromise) {
    request.resolvePromise(decision === 'approved');
  }

  pendingApprovals.delete(approvalId);

  logger.info('Approval responded', {
    approvalId,
    decision,
    alwaysAllow,
    toolName: request.toolName,
  });

  return true;
}

/**
 * Get a pending approval by ID (for API validation).
 */
export function getPendingApproval(approvalId: string): ApprovalRequest | undefined {
  return pendingApprovals.get(approvalId);
}
