import { describe, expect, it } from 'vitest';
import { renderCard } from '../src/card/run-renderer';
import type { RunState } from '../src/card/run-state';
import { renderText } from '../src/card/text-renderer';

describe('reply rendering polish', () => {
  it('adds a status banner and friendly tool names in card mode', () => {
    const card = renderCard({
      blocks: [
        {
          kind: 'tool',
          tool: {
            id: 'tool-1',
            name: 'exec_command',
            input: { command: 'pwd' },
            status: 'done',
            output: '/tmp/project',
          },
        },
      ],
      reasoning: { content: '', active: false },
      footer: null,
      terminal: 'done',
    }) as { body: { elements: Array<{ content?: string; header?: { title?: { content?: string } } }> } };

    expect(card.body.elements[0]?.content).toContain('✅ **已完成**');
    expect(JSON.stringify(card.body.elements)).toContain('**命令**');
    expect(JSON.stringify(card.body.elements)).not.toContain('exec_command');
  });

  it('polishes dense assistant text in markdown mode', () => {
    const state: RunState = {
      blocks: [
        {
          kind: 'text',
          content: '完成**核心结论**可以发布。下一步：观察反馈。',
          streaming: false,
        },
      ],
      reasoning: { content: '', active: false },
      footer: null,
      terminal: 'done',
    };

    expect(renderText(state)).toBe('完成\n\n**核心结论**可以发布。\n\n下一步：观察反馈。');
  });
});
