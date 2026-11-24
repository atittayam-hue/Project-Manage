import { useEffect, useState } from 'react';
import {
  AtSign,
  CheckSquare,
  ExternalLink,
  GitBranch,
  Plus,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { formatRelativeTime, getTaskAssigneeIds, PRIORITY_META, STATUS_COLUMNS } from '../constants';
import type {
  GitHubUser,
  ProjectSpace,
  Subtask,
  TaskItem,
  TaskPriority,
  TaskStatus,
  TeamMember,
} from '../types';
import { AssigneePicker } from './AssigneePicker';
import { MemberAvatar } from './MemberAvatar';

interface TaskDetailModalProps {
  task: TaskItem | null;
  spaces: ProjectSpace[];
  members: TeamMember[];
  authToken: string;
  githubSessionToken: string | null;
  githubUser: GitHubUser | null;
  onClose: () => void;
  onUpdateTask: (taskId: string, patch: Partial<TaskItem>) => Promise<void>;
  onMoveTask: (taskId: string, status: TaskStatus) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAddComment: (taskId: string, text: string, mentions?: string[]) => Promise<void>;
  onCreateMember: (input: { name: string; email: string; role: string }) => Promise<TeamMember>;
  onOpenGitHubSettings: () => void;
}

export function TaskDetailModal({
  task,
  spaces,
  members,
  authToken,
  githubSessionToken,
  githubUser,
  onClose,
  onUpdateTask,
  onMoveTask,
  onDeleteTask,
  onAddComment,
  onCreateMember,
  onOpenGitHubSettings,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pushRepo, setPushRepo] = useState('');
  const [pushingIssue, setPushingIssue] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setConfirmDelete(false);
      setPushError(null);
      const space = spaces.find((s) => s.id === task.spaceId);
      setPushRepo(task.githubRepo || space?.githubRepo || '');
    }
  }, [task, spaces]);

  if (!task) return null;

  const currentSpace = spaces.find((s) => s.id === task.spaceId);

  const handleSaveTitle = async () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) {
      await onUpdateTask(task.id, { title: trimmed });
    } else {
      setTitle(task.title);
    }
  };

  const handleSaveDescription = async () => {
    if (description !== task.description) {
      await onUpdateTask(task.id, { description });
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubtask.trim();
    if (!trimmed) return;
    const next: Subtask[] = [
      ...task.subtasks,
      { id: `st-${Date.now()}`, title: trimmed, completed: false },
    ];
    setNewSubtask('');
    await onUpdateTask(task.id, { subtasks: next });
  };

  const handleToggleSubtask = async (subId: string) => {
    const next = task.subtasks.map((s) =>
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    await onUpdateTask(task.id, { subtasks: next });
  };

  const handleRemoveSubtask = async (subId: string) => {
    const next = task.subtasks.filter((s) => s.id !== subId);
    await onUpdateTask(task.id, { subtasks: next });
  };

  const handleCommentChange = (value: string) => {
    setNewComment(value);
    if (value.endsWith('@')) {
      setMentionMenuOpen(true);
    } else if (!value.includes('@')) {
      setMentionMenuOpen(false);
    }
  };

  const handleInsertMention = (member: TeamMember) => {
    const base = newComment.endsWith('@') ? newComment.slice(0, -1) : newComment;
    const spacer = base && !base.endsWith(' ') ? ' ' : '';
    setNewComment(`${base}${spacer}@${member.name} `);
    setCommentMentions((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    setMentionMenuOpen(false);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;
    const matchedMentions = members
      .filter((m) => trimmed.includes(`@${m.name}`) || commentMentions.includes(m.id))
      .map((m) => m.id);
    setNewComment('');
    setCommentMentions([]);
    setMentionMenuOpen(false);
    await onAddComment(task.id, trimmed, matchedMentions);
  };

  const handleCreateGitHubIssue = async () => {
    if (!githubSessionToken || !pushRepo.trim()) return;
    setPushingIssue(true);
    setPushError(null);
    try {
      const res = await fetch('/api/github/create-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'X-GitHub-Session': githubSessionToken,
        },
        body: JSON.stringify({ taskId: task.id, repo: pushRepo.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setPushError(data.error || 'สร้าง Issue ไม่สำเร็จ');
      }
    } catch {
      setPushError('ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    } finally {
      setPushingIssue(false);
    }
  };

  const completedSubs = task.subtasks.filter((s) => s.completed).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`รายละเอียดงาน ${task.code}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {task.code}
            </span>
            {currentSpace && (
              <>
                <span aria-hidden="true">/</span>
                <span>{currentSpace.name}</span>
              </>
            )}
            {task.githubIssueNumber && task.githubIssueUrl && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={task.githubIssueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  GitHub #{task.githubIssueNumber}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>ลบงาน</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  ยืนยันการลบ?
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await onDeleteTask(task.id);
                    onClose();
                  }}
                  className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  ลบเลย
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md px-2 py-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400"
                >
                  ยกเลิก
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Two-Column Body */}
        <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 overflow-y-auto kanban-scroll">
          {/* Left Content: Title, Description, Subtasks, GitHub */}
          <div className="lg:col-span-7 p-5 space-y-6 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => void handleSaveTitle()}
                className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-lg font-bold text-slate-900 focus:border-indigo-500 focus:bg-slate-50 focus:outline-none dark:text-white dark:focus:bg-slate-800/60"
              />
            </div>

            <div>
              <label
                htmlFor="task-desc-input"
                className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5"
              >
                รายละเอียดงาน
              </label>
              <textarea
                id="task-desc-input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => void handleSaveDescription()}
                placeholder="เพิ่มคำอธิบาย ขอบเขตงาน หรือหมายเหตุ..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:bg-slate-900"
              />
            </div>

            {/* Subtasks Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  งานย่อย (Subtasks)
                </h3>
                {task.subtasks.length > 0 && (
                  <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {completedSubs}/{task.subtasks.length} เสร็จแล้ว
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {task.subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <button
                      type="button"
                      onClick={() => void handleToggleSubtask(sub.id)}
                      className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                    >
                      {sub.completed ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <span
                        className={`text-sm truncate ${
                          sub.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {sub.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoveSubtask(sub.id)}
                      aria-label="ลบงานย่อย"
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddSubtask} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="เพิ่มรายการงานย่อย..."
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={!newSubtask.trim()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  เพิ่ม
                </button>
              </form>
            </div>

            {/* GitHub Issue Sync Section */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <GitBranch className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>การเชื่อมต่อ GitHub Issue</span>
                </div>
                {githubUser && (
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                    @{githubUser.login}
                  </span>
                )}
              </div>

              {task.githubIssueNumber && task.githubIssueUrl ? (
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    ซิงก์กับ {task.githubRepo} · Issue #{task.githubIssueNumber}
                  </span>
                  <a
                    href={task.githubIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    เปิดบน GitHub
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : githubSessionToken ? (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pushRepo}
                      onChange={(e) => setPushRepo(e.target.value)}
                      placeholder="owner/repo (เช่น username/my-project)"
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={!pushRepo.trim() || pushingIssue}
                      onClick={() => void handleCreateGitHubIssue()}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap"
                    >
                      {pushingIssue ? 'กำลังสร้าง...' : 'สร้าง Issue บน GitHub'}
                    </button>
                  </div>
                  {pushError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{pushError}</p>
                  )}
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>เชื่อมต่อบัญชี GitHub เพื่อสร้าง Issue จากการ์ดงานนี้ได้โดยตรง</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenGitHubSettings();
                    }}
                    className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400 whitespace-nowrap"
                  >
                    ตั้งค่า GitHub
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Metadata & Real-Time Comments */}
          <div className="lg:col-span-5 flex flex-col bg-slate-50/50 dark:bg-slate-900/40">
            <div className="p-5 space-y-4 border-b border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    สถานะ
                  </label>
                  <select
                    value={task.status}
                    onChange={(e) => void onMoveTask(task.id, e.target.value as TaskStatus)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {STATUS_COLUMNS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    ความสำคัญ
                  </label>
                  <select
                    value={task.priority}
                    onChange={(e) =>
                      void onUpdateTask(task.id, { priority: e.target.value as TaskPriority })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {Object.entries(PRIORITY_META).map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    ผู้รับผิดชอบ (แท็กได้หลายคน)
                  </label>
                  <AssigneePicker
                    members={members}
                    selectedIds={getTaskAssigneeIds(task)}
                    onCreateMember={onCreateMember}
                    onChange={(nextIds) =>
                      void onUpdateTask(task.id, {
                        assigneeIds: nextIds,
                        assigneeId: nextIds[0] || '',
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    กำหนดส่ง
                  </label>
                  <input
                    type="date"
                    value={task.dueDate}
                    onChange={(e) => void onUpdateTask(task.id, { dueDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  พื้นที่โปรเจกต์
                </label>
                <select
                  value={task.spaceId}
                  onChange={(e) => void onUpdateTask(task.id, { spaceId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Real-Time Comments */}
            <div className="flex flex-1 flex-col p-5 min-h-[240px]">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                ความคิดเห็น ({task.comments.length})
              </h3>

              <div className="flex-1 space-y-3 overflow-y-auto max-h-60 pr-1 kanban-scroll">
                {task.comments.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    ยังไม่มีความคิดเห็น เริ่มพูดคุยเกี่ยวกับงานนี้ได้เลย
                  </p>
                ) : (
                  task.comments.map((c) => {
                    const authorMember = members.find((m) => m.id === c.authorId);
                    return (
                      <div key={c.id} className="space-y-1 rounded-lg bg-white p-3 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <MemberAvatar member={authorMember} size="xs" showName />
                          <span className="font-mono text-[10px] tabular-nums text-slate-400">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                          {c.text}
                        </p>
                        {c.mentions && c.mentions.length > 0 && (
                          <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                            แท็กถึง:{' '}
                            {c.mentions
                              .map((id) => members.find((m) => m.id === id)?.name)
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="relative mt-3">
                {mentionMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-1.5 w-60 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900 z-20">
                    <p className="px-2 py-1 text-[10px] font-semibold text-slate-400">
                      แท็กสมาชิกทีม
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {members.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleInsertMention(m)}
                          className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-indigo-950/60"
                        >
                          <MemberAvatar member={m} size="xs" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{m.name}</p>
                            {m.email && (
                              <p className="text-[10px] font-mono text-slate-400 truncate">
                                {m.email}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handlePostComment} className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMentionMenuOpen((prev) => !prev)}
                    title="แท็กผู้รับผิดชอบ (@Mention)"
                    aria-label="แท็กผู้รับผิดชอบ"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <AtSign className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => handleCommentChange(e.target.value)}
                    placeholder="พิมพ์ความคิดเห็น หรือพิมพ์ @ เพื่อแท็กคน..."
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    aria-label="ส่งความคิดเห็น"
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
