import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { TeamMember } from '../types';
import { MemberAvatar } from './MemberAvatar';

interface JoinWorkspaceModalProps {
  open: boolean;
  members: TeamMember[];
  onJoinAsNewMember: (input: { name: string; role: string }) => Promise<void>;
  onJoinAsExisting: (memberId: string) => void;
  onClose: () => void;
}

export function JoinWorkspaceModal({
  open,
  members,
  onJoinAsNewMember,
  onJoinAsExisting,
  onClose,
}: JoinWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onJoinAsNewMember({
        name: name.trim(),
        role: role.trim() || 'Team Member',
      });
      setName('');
      setRole('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="เข้าร่วมพื้นที่ทำงาน TaskPulse"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            เข้าร่วมพื้นที่ทำงาน TaskPulse
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            ระบุชื่อของคุณเพื่อเริ่มทำงานร่วมกับทีมแบบเรียลไทม์ และให้เพื่อนร่วมทีมแท็กงานถึงคุณได้
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="join-name-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              ชื่อของคุณ
            </label>
            <input
              id="join-name-input"
              autoFocus
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น นนท์ (Non)"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="join-role-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              ตำแหน่ง / หน้าที่ (ไม่บังคับ)
            </label>
            <input
              id="join-role-input"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="เช่น Frontend Developer, QA, Designer"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            <span>{submitting ? 'กำลังเข้าร่วม...' : 'เข้าร่วมพื้นที่ทำงาน'}</span>
          </button>
        </form>

        {members.length > 0 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              หรือเลือกรายชื่อที่มีอยู่แล้วในทีม
            </p>
            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto kanban-scroll">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onJoinAsExisting(m.id);
                    onClose();
                  }}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-xs hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:bg-indigo-950/30"
                >
                  <MemberAvatar member={m} size="xs" showName />
                  <span className="text-[11px] text-slate-400">{m.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
