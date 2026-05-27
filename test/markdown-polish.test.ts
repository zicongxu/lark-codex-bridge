import { describe, expect, it } from 'vitest';
import { polishAssistantMarkdown } from '../src/card/markdown-polish';

describe('polishAssistantMarkdown', () => {
  it('separates dense section headings and tables', () => {
    const input =
      '流程完成**核心结论**宏观状态良好。最终组合：| 基金 | 权重 |\n|---|---|\n| A | 10% |**Orchestrator Completion Checklist**- 已完成';

    expect(polishAssistantMarkdown(input)).toBe(
      [
        '流程完成',
        '',
        '**核心结论**宏观状态良好。最终组合：',
        '',
        '| 基金 | 权重 |',
        '|---|---|',
        '| A | 10% |',
        '',
        '**Orchestrator Completion Checklist**',
        '- 已完成',
      ].join('\n'),
    );
  });

  it('leaves normal paragraphs alone', () => {
    expect(polishAssistantMarkdown('这是一段普通回复。\n\n这是一段补充说明。')).toBe(
      '这是一段普通回复。\n\n这是一段补充说明。',
    );
  });
});
