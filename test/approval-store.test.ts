import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumeApproval, createApproval, finishApproval, getApproval } from '../src/approval/store';

function makeApproval() {
  return createApproval({
    scope: 'scope',
    chatId: 'chat',
    messageId: 'message',
    command: 'printf ok',
    cwd: process.cwd(),
    reason: 'test',
  });
}

describe('approval store', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('expires pending approvals after the confirmation window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const approval = makeApproval();

    vi.advanceTimersByTime(10 * 60_000 + 1);

    expect(getApproval(approval.id)).toBeUndefined();
  });

  it('keeps running approvals past the pending confirmation window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const approval = makeApproval();
    expect(consumeApproval(approval.id)?.status).toBe('running');

    vi.advanceTimersByTime(30 * 60_000 + 1);

    expect(getApproval(approval.id)?.status).toBe('running');
  });

  it('keeps finished approval results long enough for card refreshes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const approval = makeApproval();
    finishApproval(approval.id, { exitCode: 0, signal: null, timedOut: false });

    vi.advanceTimersByTime(10 * 60_000 + 1);

    expect(getApproval(approval.id)?.result?.exitCode).toBe(0);

    vi.advanceTimersByTime(24 * 60 * 60_000);

    expect(getApproval(approval.id)).toBeUndefined();
  });
});
