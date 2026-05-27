import { randomUUID } from 'node:crypto';

export interface PendingApproval {
  id: string;
  scope: string;
  chatId: string;
  threadId?: string;
  messageId: string;
  command: string;
  cwd: string;
  reason: string;
  createdAt: number;
  status: 'pending' | 'running' | 'denied' | 'finished';
  result?: {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
  };
}

const PENDING_TTL_MS = 10 * 60_000;
const TERMINAL_TTL_MS = 24 * 60 * 60_000;

const approvals = new Map<string, PendingApproval>();

export function createApproval(input: Omit<PendingApproval, 'id' | 'createdAt' | 'status'>): PendingApproval {
  pruneExpired();
  const approval: PendingApproval = {
    ...input,
    id: randomUUID(),
    createdAt: Date.now(),
    status: 'pending',
  };
  approvals.set(approval.id, approval);
  return approval;
}

export function getApproval(id: string): PendingApproval | undefined {
  pruneExpired();
  return approvals.get(id);
}

export function consumeApproval(id: string): PendingApproval | undefined {
  const approval = getApproval(id);
  if (!approval || approval.status !== 'pending') return undefined;
  approval.status = 'running';
  return approval;
}

export function denyApproval(id: string): PendingApproval | undefined {
  const approval = getApproval(id);
  if (!approval || approval.status !== 'pending') return undefined;
  approval.status = 'denied';
  return approval;
}

export function finishApproval(
  id: string,
  result?: PendingApproval['result'],
): PendingApproval | undefined {
  const approval = getApproval(id);
  if (!approval) return undefined;
  approval.status = 'finished';
  if (result) approval.result = result;
  return approval;
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, approval] of approvals) {
    if (approval.status === 'pending' && approval.createdAt < now - PENDING_TTL_MS) {
      approvals.delete(id);
      continue;
    }
    if (
      (approval.status === 'denied' || approval.status === 'finished') &&
      approval.createdAt < now - TERMINAL_TTL_MS
    ) {
      approvals.delete(id);
    }
  }
}
