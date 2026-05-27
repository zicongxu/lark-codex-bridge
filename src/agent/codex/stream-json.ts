import type { AgentEvent } from '../types';

interface CodexUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
}

interface CodexItem {
  id?: string;
  type?: string;
  text?: string;
  summary?: string;
  command?: string;
  status?: string;
  output?: string;
  aggregated_output?: string;
  error?: string;
  exit_code?: number | null;
  [key: string]: unknown;
}

interface CodexRawEvent {
  type?: string;
  thread_id?: string;
  item?: CodexItem;
  payload?: CodexItem;
  usage?: CodexUsage;
  message?: string;
  error?: string | { message?: string };
  [key: string]: unknown;
}

export function* translateCodexEvent(raw: unknown): Generator<AgentEvent> {
  if (!raw || typeof raw !== 'object') return;
  const evt = raw as CodexRawEvent;

  if (evt.type === 'thread.started') {
    yield { type: 'system', sessionId: evt.thread_id };
    return;
  }

  if (evt.type === 'response_item' && evt.payload) {
    yield* translateResponseItem(evt.payload);
    return;
  }

  if (evt.type === 'item.started' && evt.item) {
    const item = evt.item;
    if (item.type === 'command_execution') {
      const cwd = extractCwd(item);
      yield {
        type: 'tool_use',
        id: item.id ?? `cmd-${Date.now()}`,
        name: 'command',
        input: { command: item.command ?? summarizeUnknown(item), ...(cwd ? { cwd } : {}) },
        ...(cwd ? { cwd } : {}),
      };
    }
    return;
  }

  if (evt.type === 'item.completed' && evt.item) {
    yield* translateCompletedItem(evt.item);
    return;
  }

  if (evt.type === 'turn.completed') {
    if (evt.usage) {
      yield {
        type: 'usage',
        inputTokens: evt.usage.input_tokens ?? evt.usage.total_input_tokens,
        outputTokens: evt.usage.output_tokens ?? evt.usage.total_output_tokens,
      };
    }
    yield { type: 'done', sessionId: evt.thread_id };
    return;
  }

  if (evt.type === 'turn.failed' || evt.type === 'error') {
    yield { type: 'error', message: eventErrorMessage(evt.error, evt.message) };
  }
}

function* translateResponseItem(item: CodexItem): Generator<AgentEvent> {
  if (item.type === 'function_call') {
    const tool = typeof item.name === 'string' ? item.name : 'tool';
    const args = parseToolArguments(item.arguments);
    const command = commandFromToolArguments(args) ?? summarizeUnknown(args ?? item);
    const cwd = extractCwdFromUnknown(args);
    yield {
      type: 'tool_use',
      id: callId(item),
      name: tool,
      input: { command, ...(cwd ? { cwd } : {}) },
      ...(cwd ? { cwd } : {}),
    };
    return;
  }

  if (item.type === 'function_call_output') {
    const output = outputFromToolCall(item.output);
    yield {
      type: 'tool_result',
      id: callId(item),
      output,
      isError: isToolCallOutputError(output),
    };
  }
}

function* translateCompletedItem(item: CodexItem): Generator<AgentEvent> {
  if (item.type === 'agent_message') {
    const text = extractText(item);
    if (text) yield { type: 'text', delta: text };
    return;
  }

  if (item.type === 'reasoning') {
    const text = extractText(item);
    if (text) yield { type: 'thinking', delta: text };
    return;
  }

  if (item.type === 'command_execution') {
    const cwd = extractCwd(item);
    yield {
      type: 'tool_result',
      id: item.id ?? `cmd-${Date.now()}`,
      output: item.output ?? item.aggregated_output ?? item.error ?? summarizeUnknown(item),
      isError: Boolean(item.error) || item.status === 'failed' || isNonZeroExit(item.exit_code),
      ...(cwd ? { cwd } : {}),
    };
    return;
  }

  if (item.type === 'file_change') {
    yield {
      type: 'tool_result',
      id: item.id ?? `file-${Date.now()}`,
      output: summarizeUnknown(item),
      isError: false,
    };
  }
}

function extractText(item: CodexItem): string {
  if (typeof item.text === 'string') return item.text;
  if (typeof item.summary === 'string') return item.summary;
  const content = item.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const maybe = part as { text?: unknown; content?: unknown };
          if (typeof maybe.text === 'string') return maybe.text;
          if (typeof maybe.content === 'string') return maybe.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('');
  }
  return '';
}

function eventErrorMessage(error: CodexRawEvent['error'], message?: string): string {
  if (typeof message === 'string' && message.trim()) return message;
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string') return error.message;
  return 'codex run failed';
}

function isNonZeroExit(exitCode: unknown): boolean {
  return typeof exitCode === 'number' && Number.isFinite(exitCode) && exitCode !== 0;
}

function callId(item: CodexItem): string {
  const maybe = item.call_id ?? item.id;
  return typeof maybe === 'string' && maybe.trim() ? maybe : `call-${Date.now()}`;
}

function parseToolArguments(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function commandFromToolArguments(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ['cmd', 'command']) {
    const command = record[key];
    if (typeof command === 'string' && command.trim()) return command;
  }
  return undefined;
}

function outputFromToolCall(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return summarizeUnknown(value);
}

function isToolCallOutputError(output: string): boolean {
  const match = output.match(/Process exited with code (-?\d+)/i);
  if (match?.[1] !== undefined) return Number(match[1]) !== 0;
  return /(^|\n)(Error|Traceback|PermissionError|RuntimeError):/i.test(output);
}

function extractCwd(item: CodexItem): string | undefined {
  for (const key of ['cwd', 'workdir', 'working_directory']) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  for (const key of ['input', 'arguments']) {
    const cwd = extractCwdFromUnknown(item[key]);
    if (cwd) return cwd;
  }

  return undefined;
}

function extractCwdFromUnknown(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      return extractCwdFromUnknown(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  if (typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ['cwd', 'workdir', 'working_directory']) {
    const cwd = record[key];
    if (typeof cwd === 'string' && cwd.trim()) return cwd;
  }
  return undefined;
}

function summarizeUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
