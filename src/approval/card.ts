import type { PendingApproval } from './store';

function divMd(content: string): object {
  return { tag: 'div', text: { tag: 'lark_md', content } };
}

function code(value: string, max = 4000): string {
  const trimmed = value.length > max ? `${value.slice(0, max)}\n...` : value;
  return trimmed.replace(/`/g, '\\`');
}

export function approvalRequestCard(approval: PendingApproval): object {
  return {
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      template: 'orange',
      title: { tag: 'plain_text', content: '需要确认: 跳出沙箱执行命令' },
    },
    elements: [
      divMd(
        [
          '**状态**: 等待管理员确认',
          '',
          'Codex 在沙箱里执行失败。确认后，bridge 会在本机宿主环境执行同一条命令，并把 stdout/stderr 回传给当前会话。',
          '',
          `**工作目录**: \`${code(approval.cwd, 1000)}\``,
          '',
          '**失败摘要**:',
          '```text',
          code(approval.reason, 1200),
          '```',
          '',
          '**command**:',
          '```bash',
          code(approval.command),
          '```',
          '',
          '_只批准你能识别的命令；本次授权不会持久化。_',
        ].join('\n'),
      ),
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '允许本次' },
            type: 'danger',
            value: { cmd: 'approval.allow', id: approval.id },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '拒绝' },
            value: { cmd: 'approval.deny', id: approval.id },
          },
        ],
      },
    ],
  };
}

export function approvalRunningCard(approval: PendingApproval): object {
  return approvalStatusCard({
    title: '正在跳出沙箱执行',
    template: 'blue',
    approval,
    status: '已确认，bridge 正在本机执行该命令。\n\n执行期间按钮已失效，完成后结果会自动回传。',
    buttonText: '执行中',
  });
}

export function approvalDeniedCard(approval: PendingApproval): object {
  return approvalStatusCard({
    title: '已拒绝跳出沙箱执行',
    template: 'grey',
    approval,
    status: '用户已拒绝，本次命令不会在宿主机执行。',
    buttonText: '已拒绝',
  });
}

export function approvalExpiredCard(): object {
  return {
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      template: 'grey',
      title: { tag: 'plain_text', content: '确认请求已失效' },
    },
    elements: [
      divMd('这个跳出沙箱确认请求已经过期、已被处理，或 bridge 已重启。'),
    ],
  };
}

export function approvalFinishedCard(
  approval: PendingApproval,
  result: { exitCode: number | null; signal: NodeJS.Signals | null; timedOut: boolean },
): object {
  const ok = result.exitCode === 0 && !result.signal && !result.timedOut;
  return approvalStatusCard({
    title: ok ? '跳出沙箱执行完成' : '跳出沙箱执行结束',
    template: ok ? 'green' : 'red',
    approval,
    status: [
      `exitCode: \`${result.exitCode ?? '(none)'}\``,
      `signal: \`${result.signal ?? '(none)'}\``,
      `timedOut: \`${result.timedOut ? 'true' : 'false'}\``,
      '',
      ok ? '执行完成，结果已回传给 Codex 会话。' : '执行结束但未完全成功，结果已回传给 Codex 会话。',
    ].join('\n'),
    buttonText: '已完成',
  });
}

function approvalStatusCard(opts: {
  title: string;
  template: 'blue' | 'green' | 'grey' | 'red';
  approval: PendingApproval;
  status: string;
  buttonText?: string;
}): object {
  return {
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      template: opts.template,
      title: { tag: 'plain_text', content: opts.title },
    },
    elements: [
      divMd(
        [
          opts.status,
          '',
          `**工作目录**: \`${code(opts.approval.cwd, 1000)}\``,
          '',
          '**command**:',
          '```bash',
          code(opts.approval.command),
          '```',
        ].join('\n'),
      ),
      ...(opts.buttonText ? [disabledAction(opts.buttonText)] : []),
    ],
  };
}

function disabledAction(text: string): object {
  return {
    tag: 'action',
    actions: [
      {
        tag: 'button',
        text: { tag: 'plain_text', content: text },
        disabled: true,
        value: { processed: true },
      },
    ],
  };
}
