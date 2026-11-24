import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PRIORITY_META, STATUS_COLUMNS } from '../constants';
import type { ProjectSpace, TaskPriority, TaskStatus, TeamMember } from '../types';
import { AssigneePicker } from './AssigneePicker';

interface CreateTaskModalProps {
  open: boolean;
  spaces: ProjectSpace[];
  members: TeamMember[];
  defaultSpaceId: string;
  defaultAssigneeId: string;
  onClose: () => void;
  onCreateMember: (input: { name: string; email: string; role: string }) => Promise<TeamMember>;
  onCreate: (input: {
    spaceId: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeId: string;
    assigneeIds: string[];
    dueDate: string;
    tags: string[];
  }) => Promise<unknown>;
}

export function CreateTaskModal({
  open,
  spaces,
  members,
  defaultSpaceId,
  defaultAssigneeId,
  onClose,
  onCreateMember,
  onCreate,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [spaceId, setSpaceId] = useState(defaultSpaceId);
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    defaultAssigneeId ? [defaultAssigneeId] : []
  );
  const [dueDate, setDueDate] = useState(() =>
    new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
  );
  const [tagsRaw, setTagsRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSpaceId(defaultSpaceId || spaces[0]?.id || '');
      setAssigneeIds(defaultAssigneeId ? [defaultAssigneeId] : []);
      setSubmitError(null);
    }
  }, [open, defaultSpaceId, defaultAssigneeId, spaces]);

  if (!open) return null;

  const effectiveSpaceId = spaces.some((s) => s.id === spaceId)
    ? spaceId
    : spaces[0]?.id || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const tags = tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await onCreate({
        spaceId: effectiveSpaceId,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId: assigneeIds[0] || '',
        assigneeIds,
        dueDate,
        tags,
      });
      setTitle('');
      setDescription('');
      setTagsRaw('');
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'สร้างงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="สร้างงานใหม่"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            สร้างงานใหม่
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {submitError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {submitError}
            </div>
          )}
          <div>
            <label
              htmlFor="new-task-title"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              ชื่องาน
            </label>
            <input
              id="new-task-title"
              autoFocus
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ปรับปรุงหน้าเข้าสู่ระบบและเชื่อมต่อ API"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="new-task-desc"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              รายละเอียดเพิ่มเติม
            </label>
            <textarea
              id="new-task-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุรายละเอียดหรือเกณฑ์การตรวจรับงาน..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                โปรเจกต์
              </label>
              <select
                value={effectiveSpaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                สถานะเริ่มต้น
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {STATUS_COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                ความสำคัญ
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {Object.entries(PRIORITY_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                ผู้รับผิดชอบ (แท็กได้หลายคน)
              </label>
              <AssigneePicker
                members={members}
                selectedIds={assigneeIds}
                onChange={setAssigneeIds}
                onCreateMember={onCreateMember}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                กำหนดส่ง
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="new-task-tags"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              หมวดหมู่ / แท็ก (คั่นด้วยเครื่องหมายจุลภาค)
            </label>
            <input
              id="new-task-tags"
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="เช่น Frontend, API, Sprint-1"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'กำลังบันทึก...' : 'สร้างงาน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
