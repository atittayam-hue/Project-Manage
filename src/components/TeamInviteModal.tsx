import { useState } from 'react';
import { Check, Copy, Link2, Trash2, UserPlus, Users, X } from 'lucide-react';
import type { ActiveClient, TeamMember } from '../types';
import { MemberAvatar } from './MemberAvatar';

interface TeamInviteModalProps {
  open: boolean;
  members: TeamMember[];
  activeClients: ActiveClient[];
  activeMemberId: string;
  onClose: () => void;
  onCreateMember: (input: { name: string; role: string }) => Promise<TeamMember>;
  onDeleteMember: (memberId: string) => Promise<void>;
  onSwitchMember: (memberId: string) => void;
}

export function TeamInviteModal({
  open,
  members,
  activeClients,
  activeMemberId,
  onClose,
  onCreateMember,
  onDeleteMember,
  onSwitchMember,
}: TeamInviteModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [adding, setAdding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!open) return null;

  const baseInviteUrl = `${window.location.origin}/?join=1`;

  const copyLink = (url: string, key: string) => {
    void navigator.clipboard.writeText(url);
    setCopiedId(key);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || adding) return;
    setAdding(true);
    try {
      await onCreateMember({
        name: name.trim(),
        role: role.trim() || 'Team Member',
      });
      setName('');
      setRole('');
    } finally {
      setAdding(false);
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
        aria-label="จัดการทีมงานและเชิญเพื่อนเข้าร่วม"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              ทีมงานและการเชิญเพื่อนเข้าร่วม ({members.length} คน)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 kanban-scroll">
          {/* 1. Shareable Invite Link */}
          <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                วิธีที่ 1: ส่งลิงก์เชิญให้เพื่อนร่วมทีมกดเข้าร่วมเอง
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                เมื่อเพื่อนเปิดลิงก์นี้ จะมีหน้าต่างให้กรอกชื่อและตำแหน่งเพื่อเข้าใช้งานบอร์ดเดียวกันแบบเรียลไทม์ทันที
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 min-w-0">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{baseInviteUrl}</span>
              </div>
              <button
                type="button"
                onClick={() => copyLink(baseInviteUrl, 'invite-main')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap shrink-0"
              >
                {copiedId === 'invite-main' ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>คัดลอกลิงก์แล้ว</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>คัดลอกลิงก์เชิญ</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* 2. Add Member Directly */}
          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                วิธีที่ 2: เพิ่มรายชื่อสมาชิกไว้ล่วงหน้า (เพื่อให้แท็กบนการ์ดงานได้ทันที)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                เพิ่มชื่อเพื่อนร่วมทีมไว้ในระบบ แล้วส่งลิงก์เฉพาะตัวของแต่ละคนให้กดเข้าใช้งานได้ทันที
              </p>
            </div>

            <form onSubmit={handleAddMember} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อสมาชิก (เช่น เมย์ (May))"
                className="sm:col-span-5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="ตำแหน่ง (เช่น QA, Backend)"
                className="sm:col-span-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={!name.trim() || adding}
                className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{adding ? 'กำลังเพิ่ม...' : 'เพิ่มสมาชิก'}</span>
              </button>
            </form>
          </section>

          {/* 3. Member Directory */}
          <section className="rounded-lg border border-slate-200 overflow-hidden dark:border-slate-800">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-200">
              รายชื่อสมาชิกทั้งหมด
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((member) => {
                const isOnline = activeClients.some((c) => c.memberId === member.id);
                const isCurrent = member.id === activeMemberId;
                const personalUrl = `${window.location.origin}/?member=${encodeURIComponent(member.id)}`;

                return (
                  <div
                    key={member.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MemberAvatar member={member} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {member.name}
                          </span>
                          {isOnline && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              ออนไลน์
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {member.role}
                          {isCurrent ? ' · บัญชีที่คุณใช้งานอยู่' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyLink(personalUrl, member.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {copiedId === member.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="h-3 w-3" />
                            <span>ลิงก์เข้าใช้งาน</span>
                          </>
                        )}
                      </button>

                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => onSwitchMember(member.id)}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          ใช้งานเป็นคนนี้
                        </button>
                      )}

                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => void onDeleteMember(member.id)}
                          title={`ลบ ${member.name}`}
                          aria-label={`ลบ ${member.name}`}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
