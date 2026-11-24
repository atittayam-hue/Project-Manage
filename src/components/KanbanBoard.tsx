import { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckSquare,
  Flag,
  GitPullRequest,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { formatThaiDate, getTaskAssigneeIds, isOverdue, PRIORITY_META, STATUS_COLUMNS } from '../constants';
import type { ProjectSpace, TaskItem, TaskStatus, TeamMember } from '../types';
import { AssigneePicker } from './AssigneePicker';

interface KanbanBoardProps {
  tasks: TaskItem[];
  spaces: ProjectSpace[];
  members: TeamMember[];
  activeSpaceId: string | 'all';
  onMoveTask: (taskId: string, targetStatus: TaskStatus, targetIndex?: number) => Promise<void>;
  onUpdateTask: (taskId: string, patch: Partial<TaskItem>) => Promise<void>;
  onCreateMember: (input: { name: string; role: string }) => Promise<TeamMember>;
  onSelectTask: (task: TaskItem) => void;
  onQuickCreateTask: (status: TaskStatus, title: string) => Promise<void>;
}

export function KanbanBoard({
  tasks,
  spaces,
  members,
  onMoveTask,
  onUpdateTask,
  onCreateMember,
  onSelectTask,
  onQuickCreateTask,
}: KanbanBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: TaskStatus; index: number } | null>(null);
  const [quickAddCol, setQuickAddCol] = useState<TaskStatus | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [submittingQuick, setSubmittingQuick] = useState(false);

  const handleQuickSubmit = async (status: TaskStatus) => {
    const trimmed = quickTitle.trim();
    if (!trimmed || submittingQuick) return;
    setSubmittingQuick(true);
    try {
      await onQuickCreateTask(status, trimmed);
      setQuickTitle('');
      setQuickAddCol(null);
    } finally {
      setSubmittingQuick(false);
    }
  };

  const handleDropOnColumn = async (status: TaskStatus, targetIndex?: number) => {
    const taskId = draggedTaskId;
    setDraggedTaskId(null);
    setDragOverColumn(null);
    setDropTarget(null);
    if (!taskId) return;
    await onMoveTask(taskId, status, targetIndex);
  };

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden p-4 lg:p-6 kanban-scroll">
      <div className="grid h-full min-w-[1040px] grid-cols-4 gap-4">
        {STATUS_COLUMNS.map((col) => {
          const colTasks = tasks
            .filter((t) => t.status === col.id)
            .sort((a, b) => a.order - b.order);
          const isOverCol = dragOverColumn === col.id;

          return (
            <section
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverColumn !== col.id) setDragOverColumn(col.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverColumn(null);
                  setDropTarget(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const idx = dropTarget?.status === col.id ? dropTarget.index : colTasks.length;
                void handleDropOnColumn(col.id, idx);
              }}
              className={`flex h-full min-h-0 flex-col rounded-xl border transition-colors duration-150 ${
                isOverCol
                  ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/25'
                  : 'border-slate-200 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-900/50'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: col.dotColor }}
                  />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {col.label}
                  </h2>
                  <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {colTasks.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setQuickAddCol(col.id);
                    setQuickTitle('');
                  }}
                  title={`เพิ่มงานในคอลัมน์ ${col.label}`}
                  aria-label={`เพิ่มงานในคอลัมน์ ${col.label}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Column Body */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 kanban-scroll">
                {colTasks.length === 0 && quickAddCol !== col.id && (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ลากงานมาวางที่นี่ หรือเพิ่มงานใหม่
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAddCol(col.id);
                        setQuickTitle('');
                      }}
                      className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      + เพิ่มงานแรก
                    </button>
                  </div>
                )}

                {colTasks.map((task, idx) => {
                  const assigneeIds = getTaskAssigneeIds(task);
                  const space = spaces.find((s) => s.id === task.spaceId);
                  const priority = PRIORITY_META[task.priority];
                  const overdue = isOverdue(task.dueDate, task.status);
                  const completedSubs = task.subtasks.filter((s) => s.completed).length;
                  const totalSubs = task.subtasks.length;
                  const isDragging = draggedTaskId === task.id;
                  const showDropBefore =
                    dropTarget?.status === col.id && dropTarget.index === idx && draggedTaskId !== task.id;

                  return (
                    <div key={task.id}>
                      {showDropBefore && (
                        <div className="mb-2 h-1 rounded-full bg-indigo-500 transition-opacity" />
                      )}
                      <article
                        draggable
                        onDragStart={(e) => {
                          setDraggedTaskId(task.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', task.id);
                        }}
                        onDragEnd={() => {
                          setDraggedTaskId(null);
                          setDragOverColumn(null);
                          setDropTarget(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const afterMid = e.clientY > rect.top + rect.height / 2;
                          setDragOverColumn(col.id);
                          setDropTarget({ status: col.id, index: afterMid ? idx + 1 : idx });
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const afterMid = e.clientY > rect.top + rect.height / 2;
                          void handleDropOnColumn(col.id, afterMid ? idx + 1 : idx);
                        }}
                        onClick={() => onSelectTask(task)}
                        className={`group cursor-grab active:cursor-grabbing rounded-lg border border-slate-200 bg-white p-3.5 transition-all duration-150 hover:border-slate-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 ${
                          isDragging ? 'opacity-40 scale-[0.98]' : 'opacity-100'
                        }`}
                      >
                        {/* Quiet 1-line text metadata kicker (Zero-Pill Rule) */}
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <span className="font-mono font-medium text-slate-600 dark:text-slate-300">
                              {task.code}
                            </span>
                            {space && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{space.key}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className={`inline-flex items-center gap-1 font-medium ${priority.colorClass}`}>
                              <Flag className="h-3 w-3 shrink-0" />
                              {priority.label}
                            </span>
                          </div>

                          {task.githubIssueNumber && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                              <GitPullRequest className="h-3 w-3" />
                              #{task.githubIssueNumber}
                            </span>
                          )}
                        </div>

                        {/* Task Title */}
                        <h3 className="mt-1.5 text-sm font-medium leading-snug text-slate-900 dark:text-slate-100 line-clamp-2">
                          {task.title}
                        </h3>

                        {/* Subtask Progress Bar */}
                        {totalSubs > 0 && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className="h-full rounded-full bg-indigo-500 transition-all duration-200"
                                style={{ width: `${Math.round((completedSubs / totalSubs) * 100)}%` }}
                              />
                            </div>
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                              <CheckSquare className="h-3 w-3" />
                              {completedSubs}/{totalSubs}
                            </span>
                          </div>
                        )}

                        {/* Unboxed Tags line if present */}
                        {task.tags.length > 0 && (
                          <p className="mt-2 truncate text-[11px] text-slate-400 dark:text-slate-500">
                            {task.tags.join(' · ')}
                          </p>
                        )}

                        {/* Card Footer */}
                        <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
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

                          <div className="flex items-center gap-2 shrink-0">
                            {task.comments.length > 0 && (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-slate-400">
                                <MessageSquare className="h-3 w-3" />
                                {task.comments.length}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 font-mono text-[11px] tabular-nums ${
                                overdue
                                  ? 'font-semibold text-rose-600 dark:text-rose-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              <Calendar className="h-3 w-3" />
                              {formatThaiDate(task.dueDate)}
                            </span>

                            {/* Quick forward button for keyboard/touch accessibility */}
                            {col.id !== 'done' && (
                              <button
                                type="button"
                                title="เลื่อนไปสถานะถัดไป"
                                aria-label="เลื่อนไปสถานะถัดไป"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextMap: Record<TaskStatus, TaskStatus> = {
                                    todo: 'in_progress',
                                    in_progress: 'review',
                                    review: 'done',
                                    done: 'done',
                                  };
                                  void onMoveTask(task.id, nextMap[col.id]);
                                }}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-opacity"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    </div>
                  );
                })}

                {dropTarget?.status === col.id && dropTarget.index >= colTasks.length && (
                  <div className="h-1 rounded-full bg-indigo-500" />
                )}

                {/* Inline Quick Add Form */}
                {quickAddCol === col.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleQuickSubmit(col.id);
                    }}
                    className="rounded-lg border border-indigo-300 bg-white p-2.5 dark:border-indigo-700 dark:bg-slate-900"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      placeholder="พิมพ์ชื่องานแล้วกด Enter..."
                      className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setQuickAddCol(null)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={!quickTitle.trim() || submittingQuick}
                        className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        เพิ่มงาน
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddCol(col.id);
                      setQuickTitle('');
                    }}
                    className="w-full flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>เพิ่มงานด่วน</span>
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
