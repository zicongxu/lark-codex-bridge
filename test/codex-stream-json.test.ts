import { describe, expect, it } from 'vitest';
import { translateCodexEvent } from '../src/agent/codex/stream-json';

describe('translateCodexEvent', () => {
  it('translates Codex JSONL lifecycle and message events', () => {
    expect([...translateCodexEvent({
      type: 'thread.started',
      thread_id: 'thread-1',
    })]).toEqual([{ type: 'system', sessionId: 'thread-1' }]);

    expect([...translateCodexEvent({
      type: 'item.completed',
      item: { id: 'item-1', type: 'agent_message', text: 'OK' },
    })]).toEqual([{ type: 'text', delta: 'OK' }]);

    expect([...translateCodexEvent({
      type: 'turn.completed',
      usage: { input_tokens: 3, output_tokens: 5 },
    })]).toEqual([
      { type: 'usage', inputTokens: 3, outputTokens: 5 },
      { type: 'done', sessionId: undefined },
    ]);
  });

  it('translates command execution events', () => {
    expect([...translateCodexEvent({
      type: 'item.started',
      item: { id: 'cmd-1', type: 'command_execution', command: 'git status' },
    })]).toEqual([
      { type: 'tool_use', id: 'cmd-1', name: 'command', input: { command: 'git status' } },
    ]);

    expect([...translateCodexEvent({
      type: 'item.completed',
      item: { id: 'cmd-1', type: 'command_execution', output: 'clean', status: 'completed' },
    })]).toEqual([
      { type: 'tool_result', id: 'cmd-1', output: 'clean', isError: false },
    ]);
  });

  it('preserves command working directories for host approval replay', () => {
    expect([...translateCodexEvent({
      type: 'item.started',
      item: {
        id: 'cmd-cwd',
        type: 'command_execution',
        command: './venv311/bin/python -m src.main',
        workdir: '/Users/bytedance/Documents/trae_projects/llm_trading',
      },
    })]).toEqual([
      {
        type: 'tool_use',
        id: 'cmd-cwd',
        name: 'command',
        input: {
          command: './venv311/bin/python -m src.main',
          cwd: '/Users/bytedance/Documents/trae_projects/llm_trading',
        },
        cwd: '/Users/bytedance/Documents/trae_projects/llm_trading',
      },
    ]);

    expect([...translateCodexEvent({
      type: 'item.completed',
      item: {
        id: 'cmd-cwd',
        type: 'command_execution',
        output: 'operation not permitted',
        status: 'failed',
        input: JSON.stringify({
          cwd: '/Users/bytedance/Documents/trae_projects/llm_trading',
        }),
      },
    })]).toEqual([
      {
        type: 'tool_result',
        id: 'cmd-cwd',
        output: 'operation not permitted',
        isError: true,
        cwd: '/Users/bytedance/Documents/trae_projects/llm_trading',
      },
    ]);
  });

  it('translates Codex function call events with workdir from tool arguments', () => {
    expect([...translateCodexEvent({
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'exec_command',
        call_id: 'call-1',
        arguments: JSON.stringify({
          cmd: 'python -m src.main --portfolio multi_account_portfolio.json --account-id growth',
          workdir: '/Users/bytedance/Documents/trae_projects/llm_trading',
        }),
      },
    })]).toEqual([
      {
        type: 'tool_use',
        id: 'call-1',
        name: 'exec_command',
        input: {
          command: 'python -m src.main --portfolio multi_account_portfolio.json --account-id growth',
          cwd: '/Users/bytedance/Documents/trae_projects/llm_trading',
        },
        cwd: '/Users/bytedance/Documents/trae_projects/llm_trading',
      },
    ]);

    expect([...translateCodexEvent({
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        call_id: 'call-1',
        output: 'Process exited with code 1\nOutput:\nFailed to resolve api.waditu.com',
      },
    })]).toEqual([
      {
        type: 'tool_result',
        id: 'call-1',
        output: 'Process exited with code 1\nOutput:\nFailed to resolve api.waditu.com',
        isError: true,
      },
    ]);
  });

  it('treats non-zero command exits as tool errors and preserves aggregated output', () => {
    expect([...translateCodexEvent({
      type: 'item.completed',
      item: {
        id: 'cmd-2',
        type: 'command_execution',
        aggregated_output: 'operation not permitted',
        exit_code: 1,
        status: 'completed',
      },
    })]).toEqual([
      { type: 'tool_result', id: 'cmd-2', output: 'operation not permitted', isError: true },
    ]);
  });

  it('preserves Codex top-level error messages', () => {
    expect([...translateCodexEvent({
      type: 'error',
      message: 'network failed',
    })]).toEqual([
      { type: 'error', message: 'network failed' },
    ]);
  });
});
