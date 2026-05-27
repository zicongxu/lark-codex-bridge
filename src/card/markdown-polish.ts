const SECTION_TITLES = [
  '核心结论',
  '执行结果',
  '下一步',
  '注意事项',
  '风险提示',
  'Role Execution Log',
  'Orchestrator Completion Checklist',
];

/**
 * Smooth out common streamed-Markdown glitches before sending to Lark.
 * Codex often emits adjacent sections/tables without blank lines; Lark then
 * renders them as one dense paragraph. Keep this deliberately conservative so
 * code blocks and user-provided content stay intact.
 */
export function polishAssistantMarkdown(input: string): string {
  let out = input.replace(/\r\n/g, '\n').trim();
  if (!out) return out;

  for (const title of SECTION_TITLES) {
    out = out.replace(
      new RegExp(`([^\\n])(\\*\\*${escapeRegExp(title)}\\*\\*)([:：]?)`, 'g'),
      '$1\n\n$2$3',
    );
    out = out.replace(
      new RegExp(`([^\\n*])(${escapeRegExp(title)})([:：]?)(?!\\*)`, 'g'),
      '$1\n\n$2$3',
    );
  }

  out = out
    .replace(/([：:])\s*(\|[^\n]+\|)/g, '$1\n\n$2')
    .replace(/(\|[^\n]+\|)(\|[-:\s|]{3,}\|)/g, '$1\n$2')
    .replace(/([^\n])(-\s+(?:已|未|执行|命令|测试|Reviewer|Implementer|Actions))/g, '$1\n$2')
    .replace(/([^\n])(```[a-zA-Z0-9_-]*\n)/g, '$1\n\n$2')
    .replace(/(\n```)([^\n])/g, '$1\n\n$2')
    .replace(/\n{3,}/g, '\n\n');

  return out.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
