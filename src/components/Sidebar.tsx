import {
  BarChart3,
  Download,
  FileCode2,
  FolderPlus,
  GitBranch,
  Kanban,
  Layers,
  ListTodo,
  LogOut,
  Moon,
  RotateCcw,
  Sun,
  UserPlus,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { ConnectionState } from '../hooks/useWorkspaceSocket';
import type { ActiveClient, ProjectSpace, TaskItem, TeamMember, ViewMode } from '../types';
import { MemberAvatar } from './MemberAvatar';

interface SidebarProps {
  spaces: ProjectSpace[];
  tasks: TaskItem[];
  members: TeamMember[];
  activeClients: ActiveClient[];
  currentUser: TeamMember;
  onLogout: () => void;
  activeSpaceId: string | 'all';
  onSelectSpace: (spaceId: string | 'all') => void;
  viewMode: ViewMode;
  onSelectView: (view: ViewMode) => void;
  connectionState: ConnectionState;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenCreateSpace: () => void;
  onOpenTeamInvite: () => void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  onResetWorkspace: () => Promise<void>;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  spaces,
  tasks,
  members,
  activeClients,
  currentUser,
  onLogout,
  activeSpaceId,
  onSelectSpace,
  viewMode,
  onSelectView,
  connectionState,
  darkMode,
  onToggleDarkMode,
  onOpenCreateSpace,
  onOpenTeamInvite,
  onExportMarkdown,
  onExportJson,
  onResetWorkspace,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const navItems: Array<{ id: ViewMode; label: string; icon: typeof Kanban }> = [
    { id: 'kanban', label: 'บอร์ดคัมบัง', icon: Kanban },
    { id: 'dashboard', label: 'แดชบอร์ดสรุปผล', icon: BarChart3 },
    { id: 'list', label: 'มุมมองรายการ', icon: ListTodo },
    { id: 'github', label: 'เชื่อมต่อ GitHub', icon: GitBranch },
  ];

  const uniqueOnlineMembers = new Map<string, ActiveClient>();
  for (const client of activeClients) {
    if (!uniqueOnlineMembers.has(client.memberId)) {
      uniqueOnlineMembers.set(client.memberId, client);
    }
  }

  const sidebarContent = (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Brand Row */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            onSelectSpace('all');
            onSelectView('kanban');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
            T
          </span>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            TaskPulse
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleDarkMode}
            title={darkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
            aria-label={darkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="ปิดเมนู"
            className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 kanban-scroll">
        <div>
          <p className="px-2.5 mb-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
            มุมมองการทำงาน
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = viewMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectView(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Spaces / Projects */}
        <div>
          <div className="flex items-center justify-between px-2.5 mb-2">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              พื้นที่โปรเจกต์ (Spaces)
            </p>
            <button
              type="button"
              onClick={onOpenCreateSpace}
              title="สร้างโปรเจกต์ใหม่"
              aria-label="สร้างโปรเจกต์ใหม่"
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-colors"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onSelectSpace('all');
                if (viewMode === 'github') onSelectView('kanban');
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSpaceId === 'all' && viewMode !== 'github'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Layers className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">ทุกโปรเจกต์</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
                {tasks.length}
              </span>
            </button>

            {spaces.map((space) => {
              const count = tasks.filter((t) => t.spaceId === space.id).length;
              const isSelected = activeSpaceId === space.id && viewMode !== 'github';
              return (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => {
                    onSelectSpace(space.id);
                    if (viewMode === 'github') onSelectView('kanban');
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: space.color }}
                    />
                    <span className="truncate">{space.name}</span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Team & Invite + GitHub Export */}
        <div>
          <p className="px-2.5 mb-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
            ทีมงานและส่งออกข้อมูล
          </p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onOpenTeamInvite();
                onCloseMobile();
              }}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40 transition-colors whitespace-nowrap"
            >
              <span className="flex items-center gap-2.5">
                <UserPlus className="h-4 w-4 shrink-0" />
                <span>เชิญเพื่อนเข้าทีม</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-indigo-500/80 dark:text-indigo-400/80">
                {members.length}
              </span>
            </button>
            <button
              type="button"
              onClick={onExportMarkdown}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100 transition-colors whitespace-nowrap"
            >
              <FileCode2 className="h-4 w-4 shrink-0" />
              <span>ส่งออก TASKS.md</span>
            </button>
            <button
              type="button"
              onClick={onExportJson}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100 transition-colors whitespace-nowrap"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>สำรองข้อมูล JSON</span>
            </button>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span>ล้างข้อมูลเริ่มต้นใหม่</span>
              </button>
            ) : (
              <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-2.5 space-y-2 dark:border-rose-900/60 dark:bg-rose-950/30">
                <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
                  ยืนยันล้างงานและโปรเจกต์ทั้งหมด?
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={async () => {
                      setResetting(true);
                      try {
                        await onResetWorkspace();
                        setConfirmReset(false);
                      } finally {
                        setResetting(false);
                      }
                    }}
                    className="flex-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {resetting ? 'กำลังล้าง...' : 'ยืนยันล้าง'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="rounded-md px-2 py-1 text-[11px] text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Real-Time Presence & Logged-in Profile */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionState === 'connected'
                  ? 'bg-emerald-500'
                  : 'bg-amber-500 animate-pulse'
              }`}
            />
            {connectionState === 'connected' ? 'ซิงก์เรียลไทม์' : 'กำลังเชื่อมต่อใหม่...'}
          </span>
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {activeClients.length} ออนไลน์
          </span>
        </div>

        {uniqueOnlineMembers.size > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5 overflow-hidden">
              {Array.from(uniqueOnlineMembers.values()).map((client) => {
                const member = members.find((m) => m.id === client.memberId);
                return (
                  <div key={client.clientId} title={`${client.name} (ออนไลน์)`}>
                    <MemberAvatar member={member} size="xs" />
                  </div>
                );
              })}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
              กำลังใช้งานร่วมกัน
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 min-w-0">
            <MemberAvatar member={currentUser} size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {currentUser.name}
              </p>
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                {currentUser.email || currentUser.role}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-rose-400 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <div className="hidden lg:block shrink-0 h-full">{sidebarContent}</div>

      {/* Mobile slide-over sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
