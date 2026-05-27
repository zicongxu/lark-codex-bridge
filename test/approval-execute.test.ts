import { describe, expect, it } from 'vitest';
import { executeApprovedCommand } from '../src/approval/execute';

describe('executeApprovedCommand', () => {
  it('runs an approved command and captures output', async () => {
    const result = await executeApprovedCommand('printf approval-ok', process.cwd(), 5_000);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('approval-ok');
    expect(result.stderr).toBe('');
    expect(result.timedOut).toBe(false);
  });
});
