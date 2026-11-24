import { useState } from 'react';
import type { TeamMember } from '../types';

interface MemberAvatarProps {
  member?: TeamMember;
  size?: 'xs' | 'sm' | 'md';
  showName?: boolean;
}

export function MemberAvatar({ member, size = 'sm', showName = false }: MemberAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const sizeClass =
    size === 'xs'
      ? 'h-5 w-5 text-[10px]'
      : size === 'md'
        ? 'h-8 w-8 text-xs'
        : 'h-6 w-6 text-[11px]';

  const initials = member?.initials || 'TM';
  const name = member?.name || 'ไม่ระบุ';

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {member?.avatarUrl && !imgError ? (
        <img
          src={member.avatarUrl}
          alt={`รูปโปรไฟล์ของ ${name}`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`${sizeClass} rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700`}
        />
      ) : (
        <span
          className={`${sizeClass} rounded-full shrink-0 inline-flex items-center justify-center font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800`}
        >
          {initials}
        </span>
      )}
      {showName && (
        <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
          {name}
        </span>
      )}
    </span>
  );
}

interface AssigneeStackProps {
  members: TeamMember[];
  assigneeIds: string[];
  emptyLabel?: string;
}

export function AssigneeStack({
  members,
  assigneeIds,
  emptyLabel = 'ยังไม่ระบุ',
}: AssigneeStackProps) {
  const assigned = assigneeIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is TeamMember => Boolean(m));

  if (assigned.length === 0) {
    return (
      <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
        {emptyLabel}
      </span>
    );
  }

  if (assigned.length === 1) {
    return <MemberAvatar member={assigned[0]} size="xs" showName />;
  }

  const visible = assigned.slice(0, 3);
  const extra = assigned.length - visible.length;

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="flex -space-x-1.5 shrink-0">
        {visible.map((m) => (
          <span key={m.id} title={m.name} className="inline-flex ring-2 ring-white dark:ring-slate-900 rounded-full">
            <MemberAvatar member={m} size="xs" />
          </span>
        ))}
      </span>
      <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
        {extra > 0 ? `+${extra} คน` : `${assigned.length} คน`}
      </span>
    </span>
  );
}
