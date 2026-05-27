import { spawn } from 'node:child_process';

export interface ApprovalExecutionResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const MAX_OUTPUT_CHARS = 20_000;
const DEFAULT_TIMEOUT_MS = 30 * 60_000;

export function executeApprovedCommand(
  command: string,
  cwd: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ApprovalExecutionResult> {
  return new Promise((resolve) => {
    const child = spawn('/bin/zsh', ['-lc', command], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const append = (current: string, chunk: Buffer): string => {
      const next = current + chunk.toString('utf8');
      return next.length > MAX_OUTPUT_CHARS ? next.slice(-MAX_OUTPUT_CHARS) : next;
    };

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform !== 'win32' && child.pid) {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          child.kill('SIGTERM');
        }
      } else {
        child.kill('SIGTERM');
      }
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: null,
        signal: null,
        stdout,
        stderr: `${stderr}${stderr ? '\n' : ''}${err.message}`,
        timedOut,
      });
    });

    child.on('exit', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal, stdout, stderr, timedOut });
    });
  });
}
