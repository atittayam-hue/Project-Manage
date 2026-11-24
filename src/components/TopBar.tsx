import { useEffect, useRef, useState } from 'react';
import { AtSign, Bell, CheckCheck, Menu, Plus, Search, UserCheck } from 'lucide-react';
import { formatRelativeTime } from '../constants';
import type { AppNotification, ProjectSpace, TaskPriority, TeamMember, ViewMode } from '../types';

interface TopBarProps {
  activeSpace?: ProjectSpace;
  members: TeamMember[];
  notifications: AppNotification[];
  viewMode: ViewMode;
  onSelectView: (view: ViewMode) => void;
  searchQuery: string;
  onChangeSearch: (value: string) => void;
  priorityFilter: TaskPriority | 'all';
  onChangePriorityFilter: (priority: TaskPriority | 'all') => void;
  assigneeFilter: string | 'all';
  onChangeAssigneeFilter: (memberId: string | 'all') => void;
  onSelectNotification: (notification: AppNotification) => void;
  onMarkAllNotificationsRead: () => void;
  onOpenCreateTask: () => void;
  onOpenMobileMenu: () => void;
}

export function TopBar({
  activeSpace,
  members,
  notifications,
  viewMode,
  onSelectView,
  searchQuery,
  onChangeSearch,
  priorityFilter,
  onChangePriorityFilter,
  assigneeFilter,
  onChangeAssigneeFilter,
  onSelectNotification,
  onMarkAllNotificationsRead,
  onOpenCreateTask,
  onOpenMobileMenu,
}: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [browserNotifState, setBrowserNotifState] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [notifOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const viewTitles: Record<ViewMode, string> = {
    kanban: 'บอร์ดคัมบัง',
    dashboard: 'แดชบอร์ดสรุปผลงาน',
    list: 'มุมมองรายการ',
    github: 'เชื่อมต่อและซิงก์ GitHub',
  };

  const requestBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setBrowserNotifState(result);
    } catch {
      // Ignore permission rejection
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 lg:px-6 dark:border-slate-800 dark:bg-slate-900">
      {/* Zone 1: Breadcrumb & Mobile Menu */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="เปิดเมนูด้านข้าง"
          className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="font-semibold text-slate-900 dark:text-white truncate">
            {viewMode === 'github'
              ? 'GitHub Integration'
              : activeSpace
                ? activeSpace.name
                : 'ทุกโปรเจกต์'}
          </span>
          <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
            /
          </span>
          <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
            {viewTitles[viewMode]}
          </span>
        </div>
      </div>

      {/* Zone 2: Segmented View Switcher & Search Filter */}
      <div className="hidden md:flex items-center gap-3">
        {viewMode !== 'github' && (
          <>
            <div className="relative w-48 lg:w-60">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onChangeSearch(e.target.value)}
                placeholder="ค้นหางาน รหัส หรือ #issue..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
              />
            </div>

            <select
              aria-label="กรองตามความสำคัญ"
              value={priorityFilter}
              onChange={(e) => onChangePriorityFilter(e.target.value as TaskPriority | 'all')}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">ความสำคัญ: ทั้งหมด</option>
              <option value="urgent">ด่วนมาก</option>
              <option value="high">สูง</option>
              <option value="normal">ปกติ</option>
              <option value="low">ต่ำ</option>
            </select>

            <select
              aria-label="กรองตามผู้รับผิดชอบ"
              value={assigneeFilter}
              onChange={(e) => onChangeAssigneeFilter(e.target.value)}
              className="max-w-[160px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">ผู้รับผิดชอบ: ทุกคน</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              { id: 'kanban', label: 'คัมบัง' },
              { id: 'list', label: 'รายการ' },
              { id: 'dashboard', label: 'แดชบอร์ด' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectView(tab.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === tab.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone 3: Notification Bell & Primary Action CTA */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-label={`การแจ้งเตือน${unreadCount > 0 ? ` (${unreadCount} ยังไม่ได้อ่าน)` : ''}`}
            aria-expanded={notifOpen}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 font-mono text-[10px] font-bold tabular-nums text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                    การแจ้งเตือน
                  </h3>
                  {unreadCount > 0 && (
                    <span className="font-mono text-[11px] tabular-nums text-rose-600 dark:text-rose-400">
                      {unreadCount} ใหม่
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onMarkAllNotificationsRead();
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>อ่านทั้งหมด</span>
                  </button>
                )}
              </div>

              {browserNotifState === 'default' && (
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-indigo-50/70 px-4 py-2 text-[11px] dark:border-slate-800 dark:bg-indigo-950/30">
                  <span className="text-slate-600 dark:text-slate-300">
                    เปิดการแจ้งเตือนเดสก์ท็อปเมื่อมีคนแท็กคุณ
                  </span>
                  <button
                    type="button"
                    onClick={() => void requestBrowserNotifications()}
                    className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400 whitespace-nowrap"
                  >
                    อนุญาต
                  </button>
                </div>
              )}

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 kanban-scroll">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      ยังไม่มีการแจ้งเตือน
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                      เมื่อมีคนแท็กคุณเป็นผู้รับผิดชอบหรือ @mention ในคอมเมนต์ ระบบจะแจ้งเตือนที่นี่ทันที
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onSelectNotification(n);
                        setNotifOpen(false);
                      }}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        !n.read ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          n.type === 'comment_mention'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                        }`}
                      >
                        {n.type === 'comment_mention' ? (
                          <AtSign className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {n.actorName}
                          </span>
                          <span className="font-mono text-[10px] tabular-nums text-slate-400 shrink-0">
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {n.message}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {n.taskCode} · {n.taskTitle}
                        </p>
                      </div>

                      {!n.read && (
                        <span
                          aria-label="ยังไม่ได้อ่าน"
                          className="mt-2 h-2 w-2 rounded-full bg-indigo-600 shrink-0"
                        />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenCreateTask}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>สร้างงานใหม่</span>
        </button>
      </div>
    </header>
  );
}
