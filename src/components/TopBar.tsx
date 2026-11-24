import { Menu, Plus, Search } from 'lucide-react';
import type { ProjectSpace, TaskPriority, TeamMember, ViewMode } from '../types';

interface TopBarProps {
  activeSpace?: ProjectSpace;
  members: TeamMember[];
  viewMode: ViewMode;
  onSelectView: (view: ViewMode) => void;
  searchQuery: string;
  onChangeSearch: (value: string) => void;
  priorityFilter: TaskPriority | 'all';
  onChangePriorityFilter: (priority: TaskPriority | 'all') => void;
  assigneeFilter: string | 'all';
  onChangeAssigneeFilter: (memberId: string | 'all') => void;
  onOpenCreateTask: () => void;
  onOpenMobileMenu: () => void;
}

export function TopBar({
  activeSpace,
  members,
  viewMode,
  onSelectView,
  searchQuery,
  onChangeSearch,
  priorityFilter,
  onChangePriorityFilter,
  assigneeFilter,
  onChangeAssigneeFilter,
  onOpenCreateTask,
  onOpenMobileMenu,
}: TopBarProps) {
  const viewTitles: Record<ViewMode, string> = {
    kanban: 'บอร์ดคัมบัง',
    dashboard: 'แดชบอร์ดสรุปผลงาน',
    list: 'มุมมองรายการ',
    github: 'เชื่อมต่อและซิงก์ GitHub',
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
            <div className="relative w-52 lg:w-64">
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

      {/* Zone 3: Single Primary Action CTA */}
      <div className="flex items-center shrink-0">
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
