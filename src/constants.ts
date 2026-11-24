import type { TaskItem, TaskPriority, TaskStatus } from './types';

export interface StatusColumnMeta {
  id: TaskStatus;
  label: string;
  englishLabel: string;
  dotColor: string;
  textColor: string;
  surfaceTint: string;
}

export const STATUS_COLUMNS: StatusColumnMeta[] = [
  {
    id: 'todo',
    label: 'รอดำเนินการ',
    englishLabel: 'To Do',
    dotColor: '#64748B',
    textColor: 'text-slate-700 dark:text-slate-300',
    surfaceTint: 'bg-slate-100/80 dark:bg-slate-900/60',
  },
  {
    id: 'in_progress',
    label: 'กำลังทำ',
    englishLabel: 'In Progress',
    dotColor: '#4F46E5',
    textColor: 'text-indigo-700 dark:text-indigo-300',
    surfaceTint: 'bg-indigo-50/50 dark:bg-indigo-950/30',
  },
  {
    id: 'review',
    label: 'รอตรวจสอบ',
    englishLabel: 'In Review',
    dotColor: '#D97706',
    textColor: 'text-amber-700 dark:text-amber-300',
    surfaceTint: 'bg-amber-50/50 dark:bg-amber-950/30',
  },
  {
    id: 'done',
    label: 'เสร็จสิ้น',
    englishLabel: 'Done',
    dotColor: '#16A34A',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    surfaceTint: 'bg-emerald-50/50 dark:bg-emerald-950/30',
  },
];

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; colorClass: string; flagColor: string; rank: number }
> = {
  urgent: {
    label: 'ด่วนมาก',
    colorClass: 'text-rose-600 dark:text-rose-400',
    flagColor: '#E11D48',
    rank: 0,
  },
  high: {
    label: 'สูง',
    colorClass: 'text-amber-600 dark:text-amber-400',
    flagColor: '#D97706',
    rank: 1,
  },
  normal: {
    label: 'ปกติ',
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    flagColor: '#4F46E5',
    rank: 2,
  },
  low: {
    label: 'ต่ำ',
    colorClass: 'text-slate-500 dark:text-slate-400',
    flagColor: '#64748B',
    rank: 3,
  },
};

export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return 'ไม่ระบุวัน';
  const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

export function formatRelativeTime(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'เมื่อสักครู่';
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

export function isOverdue(dueDate: string, status: TaskStatus): boolean {
  if (status === 'done' || !dueDate) return false;
  const todayStr = new Date().toISOString().slice(0, 10);
  return dueDate < todayStr;
}

export function getTaskAssigneeIds(task: TaskItem): string[] {
  if (Array.isArray(task.assigneeIds)) return task.assigneeIds;
  return task.assigneeId ? [task.assigneeId] : [];
}
