import { getTaskAssigneeIds, PRIORITY_META, STATUS_COLUMNS } from '../constants';
import type { ProjectSpace, TaskItem, WorkspaceState } from '../types';

export function generateGitHubMarkdown(state: WorkspaceState, activeSpaceId: string | 'all'): string {
  const targetSpaces =
    activeSpaceId === 'all'
      ? state.spaces
      : state.spaces.filter((s) => s.id === activeSpaceId);

  const filteredTasks =
    activeSpaceId === 'all'
      ? state.tasks
      : state.tasks.filter((t) => t.spaceId === activeSpaceId);

  const completed = filteredTasks.filter((t) => t.status === 'done').length;
  const total = filteredTasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const lines: string[] = [
    `# Project Tasks Summary (${targetSpaces.map((s) => s.name).join(', ')})`,
    '',
    `> Updated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · Progress: **${completed}/${total} (${pct}%)**`,
    '',
  ];

  for (const col of STATUS_COLUMNS) {
    const colTasks = filteredTasks
      .filter((t) => t.status === col.id)
      .sort((a, b) => a.order - b.order);

    lines.push(`## ${col.label} (${col.englishLabel}) — ${colTasks.length}`);
    lines.push('');

    if (colTasks.length === 0) {
      lines.push('- _ไม่มีรายการงานในสถานะนี้_');
      lines.push('');
      continue;
    }

    for (const task of colTasks) {
      const check = task.status === 'done' ? 'x' : ' ';
      const assigneeNames = getTaskAssigneeIds(task)
        .map((id) => state.members.find((m) => m.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      const priority = PRIORITY_META[task.priority]?.label || task.priority;
      const ghRef = task.githubIssueNumber && task.githubIssueUrl
        ? ` · [GitHub #${task.githubIssueNumber}](${task.githubIssueUrl})`
        : '';

      lines.push(
        `- [${check}] **${task.code}** ${task.title} — *ความสำคัญ: ${priority}* · ผู้รับผิดชอบ: ${assigneeNames || 'ไม่ระบุ'} · กำหนดส่ง: \`${task.dueDate}\`${ghRef}`
      );
      if (task.subtasks.length > 0) {
        for (const sub of task.subtasks) {
          lines.push(`  - [${sub.completed ? 'x' : ' '}] ${sub.title}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportWorkspaceJson(state: WorkspaceState, activeSpace?: ProjectSpace) {
  const payload = activeSpace
    ? {
        exportedAt: new Date().toISOString(),
        space: activeSpace,
        tasks: state.tasks.filter((t) => t.spaceId === activeSpace.id),
      }
    : {
        exportedAt: new Date().toISOString(),
        ...state,
      };
  const filename = activeSpace ? `taskpulse-${activeSpace.key.toLowerCase()}.json` : 'taskpulse-workspace.json';
  downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

export function sortTasksByOrderAndPriority(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => a.order - b.order);
}
