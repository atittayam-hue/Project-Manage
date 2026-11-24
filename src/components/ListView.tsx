import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Flag } from 'lucide-react';
import { formatThaiDate, getTaskAssigneeIds, isOverdue, PRIORITY_META, STATUS_COLUMNS } from '../constants';
import type { ProjectSpace, TaskItem, TaskPriority, TaskStatus, TeamMember } from '../types';
import { AssigneePicker } from './AssigneePicker';

interface ListViewProps {
  tasks: TaskItem[];
  spaces: ProjectSpace[];
  members: TeamMember[];
  onSelectTask: (task: TaskItem) => void;
  onUpdateTask: (taskId: string, patch: Partial<TaskItem>) => Promise<void>;
  onMoveTask: (taskId: string, targetStatus: TaskStatus) => Promise<void>;
  onCreateMember: (input: { name: string; role: string }) => Promise<TeamMember>;
}

export function ListView({
  tasks,
  spaces,
  members,
  onSelectTask,
  onUpdateTask,
  onMoveTask,
  onCreateMember,
}: ListViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (status: TaskStatus) => {
    setCollapsed((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6 space-y-5 kanban-scroll">
      {STATUS_COLUMNS.map((col) => {
        const groupTasks = tasks
          .filter((t) => t.status === col.id)
          .sort((a, b) => a.order - b.order);
        const isCollapsed = Boolean(collapsed[col.id]);

        return (
          <section
            key={col.id}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Group Header */}
            <button
              type="button"
              onClick={() => toggleGroup(col.id)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800 text-left"
            >
              <span className="flex items-center gap-2.5">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
                <span
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: col.dotColor }}
                />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {col.label}
                </span>
                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {groupTasks.length} รายการ
                </span>
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {col.englishLabel}
              </span>
            </button>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                {groupTasks.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    ไม่มีรายการงานในสถานะ {col.label}
                  </p>
                ) : (
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <th className="py-2 pl-4 pr-3 w-24">รหัส</th>
                        <th className="py-2 px-3">ชื่องาน</th>
                        <th className="py-2 px-3 w-36">สถานะ</th>
                        <th className="py-2 px-3 w-32">ความสำคัญ</th>
                        <th className="py-2 px-3 w-44">ผู้รับผิดชอบ</th>
                        <th className="py-2 px-3 w-28 text-right">กำหนดส่ง</th>
                        <th className="py-2 pl-3 pr-4 w-24 text-right">GitHub</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {groupTasks.map((task) => {
                        const assigneeIds = getTaskAssigneeIds(task);
                        const space = spaces.find((s) => s.id === task.spaceId);
                        const priority = PRIORITY_META[task.priority];
                        const overdue = isOverdue(task.dueDate, task.status);

                        return (
                          <tr
                            key={task.id}
                            className="h-11 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="pl-4 pr-3 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {task.code}
                            </td>
                            <td className="px-3 min-w-[260px]">
                              <button
                                type="button"
                                onClick={() => onSelectTask(task)}
                                className="text-left font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400 line-clamp-1"
                              >
                                {task.title}
                              </button>
                              {space && (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                  {space.name}
                                  {task.subtasks.length > 0 && (
                                    <>
                                      {' · '}
                                      <span className="font-mono tabular-nums">
                                        {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} งานย่อย
                                      </span>
                                    </>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="px-3">
                              <select
                                aria-label={`สถานะของ ${task.title}`}
                                value={task.status}
                                onChange={(e) => void onMoveTask(task.id, e.target.value as TaskStatus)}
                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                {STATUS_COLUMNS.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3">
                              <div className="inline-flex items-center gap-1.5">
                                <Flag
                                  className="h-3.5 w-3.5 shrink-0"
                                  style={{ color: priority.flagColor }}
                                />
                                <select
                                  aria-label={`ความสำคัญของ ${task.title}`}
                                  value={task.priority}
                                  onChange={(e) =>
                                    void onUpdateTask(task.id, {
                                      priority: e.target.value as TaskPriority,
                                    })
                                  }
                                  className={`bg-transparent text-xs font-medium focus:outline-none ${priority.colorClass}`}
                                >
                                  <option value="urgent">ด่วนมาก</option>
                                  <option value="high">สูง</option>
                                  <option value="normal">ปกติ</option>
                                  <option value="low">ต่ำ</option>
                                </select>
                              </div>
                            </td>
                            <td className="px-3">
                              <AssigneePicker
                                compact
                                members={members}
                                selectedIds={assigneeIds}
                                onCreateMember={onCreateMember}
                                onChange={(nextIds) =>
                                  void onUpdateTask(task.id, {
                                    assigneeIds: nextIds,
                                    assigneeId: nextIds[0] || '',
                                  })
                                }
                              />
                            </td>
                            <td
                              className={`px-3 text-right font-mono text-xs tabular-nums whitespace-nowrap ${
                                overdue
                                  ? 'font-semibold text-rose-600 dark:text-rose-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {formatThaiDate(task.dueDate)}
                            </td>
                            <td className="pl-3 pr-4 text-right">
                              {task.githubIssueNumber && task.githubIssueUrl ? (
                                <a
                                  href={task.githubIssueUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                  #{task.githubIssueNumber}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
