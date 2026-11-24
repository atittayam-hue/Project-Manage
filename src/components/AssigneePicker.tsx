import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, UserPlus } from 'lucide-react';
import type { TeamMember } from '../types';
import { AssigneeStack, MemberAvatar } from './MemberAvatar';

interface AssigneePickerProps {
  members: TeamMember[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  onCreateMember?: (input: { name: string; role: string }) => Promise<TeamMember>;
  compact?: boolean;
  align?: 'left' | 'right';
}

export function AssigneePicker({
  members,
  selectedIds,
  onChange,
  onCreateMember,
  compact = false,
  align = 'left',
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [savingMember, setSavingMember] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAddingMember(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setAddingMember(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const toggleMember = (memberId: string) => {
    if (selectedIds.includes(memberId)) {
      onChange(selectedIds.filter((id) => id !== memberId));
    } else {
      onChange([...selectedIds, memberId]);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateMember || !newName.trim() || savingMember) return;
    setSavingMember(true);
    try {
      const created = await onCreateMember({
        name: newName.trim(),
        role: newRole.trim() || 'Team Member',
      });
      onChange([...selectedIds, created.id]);
      setNewName('');
      setNewRole('');
      setAddingMember(false);
    } finally {
      setSavingMember(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block max-w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        title="แท็กหรือเปลี่ยนผู้รับผิดชอบ"
        className={
          compact
            ? 'inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors max-w-[140px]'
            : 'w-full flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:border-slate-300 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
        }
      >
        <AssigneeStack
          members={members}
          assigneeIds={selectedIds}
          emptyLabel={compact ? '+ แท็กผู้รับผิดชอบ' : 'เลือกผู้รับผิดชอบ...'}
        />
        {!compact && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
      </button>

      {open && (
        <div
          className={`absolute z-40 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>ผู้รับผิดชอบ ({selectedIds.length})</span>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-normal"
              >
                ล้างทั้งหมด
              </button>
            )}
          </div>

          <div className="mt-1 max-h-48 overflow-y-auto space-y-0.5 kanban-scroll">
            {members.map((member) => {
              const checked = selectedIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleMember(member.id)}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                    checked
                      ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MemberAvatar member={member} size="xs" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{member.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{member.role}</p>
                    </div>
                  </div>
                  {checked && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                </button>
              );
            })}
          </div>

          {onCreateMember && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {!addingMember ? (
                <button
                  type="button"
                  onClick={() => setAddingMember(true)}
                  className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>เพิ่มสมาชิกทีมใหม่</span>
                </button>
              ) : (
                <form onSubmit={handleAddMember} className="space-y-2 p-1">
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ชื่อสมาชิก (เช่น บีม (Beam))"
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="ตำแหน่ง (ไม่บังคับ)"
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAddingMember(false)}
                      className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={!newName.trim() || savingMember}
                      className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      เพิ่ม
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
