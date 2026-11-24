import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  GitBranch,
  Layers,
} from 'lucide-react';
import { formatRelativeTime, getTaskAssigneeIds, isOverdue, PRIORITY_META, STATUS_COLUMNS } from '../constants';
import type { ActivityLog, ProjectSpace, TaskItem, TaskPriority, TeamMember } from '../types';
import { MemberAvatar } from './MemberAvatar';

interface DashboardViewProps {
  tasks: TaskItem[];
  spaces: ProjectSpace[];
  members: TeamMember[];
  activities: ActivityLog[];
  onSelectTask: (task: TaskItem) => void;
  onOpenGitHub: () => void;
}

export function DashboardView({
  tasks,
  spaces,
  members,
  activities,
  onSelectTask,
  onOpenGitHub,
}: DashboardViewProps) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress' || t.status === 'review').length;
  const urgentOrOverdueTasks = tasks.filter(
    (t) => t.priority === 'urgent' || isOverdue(t.dueDate, t.status)
  ).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const githubLinkedCount = tasks.filter((t) => Boolean(t.githubIssueNumber)).length;

  // SVG Donut Calculations
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let runningOffset = 0;

  const statusSlices = STATUS_COLUMNS.map((col) => {
    const count = tasks.filter((t) => t.status === col.id).length;
    const ratio = totalTasks > 0 ? count / totalTasks : 0;
    const strokeLength = ratio * circumference;
    const offset = runningOffset;
    runningOffset += strokeLength;
    return {
      ...col,
      count,
      percentage: totalTasks > 0 ? Math.round(ratio * 100) : 0,
      strokeLength,
      offset,
    };
  });

  const priorityOrder: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];
  const priorityStats = priorityOrder.map((p) => {
    const count = tasks.filter((t) => t.priority === p).length;
    return {
      id: p,
      ...PRIORITY_META[p],
      count,
      percentage: totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0,
    };
  });

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6 space-y-6 kanban-scroll">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>งานทั้งหมดในขอบเขต</span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {totalTasks}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            กระจายใน {spaces.length} โปรเจกต์ · เชื่อม GitHub {githubLinkedCount} งาน
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>งานที่เสร็จสิ้นแล้ว</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {completedTasks}
            </p>
            <span className="font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {completionRate}%
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>กำลังทำและรอตรวจสอบ</span>
            <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {inProgressTasks}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            กำลังดำเนินงานอยู่แบบเรียลไทม์
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>เร่งด่วนหรือเลยกำหนด</span>
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {urgentOrOverdueTasks}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            รายการที่ควรเร่งติดตามสถานะ
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Status Donut Chart */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                สัดส่วนงานตามสถานะ (Status Breakdown)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                อัปเดตอัตโนมัติทันทีเมื่อมีการลากวางบนบอร์ดคัมบัง
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-8">
            <div className="relative h-40 w-40 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="16"
                  className="text-slate-100 dark:text-slate-800"
                />
                {totalTasks > 0 &&
                  statusSlices.map((slice) => (
                    <circle
                      key={slice.id}
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="none"
                      stroke={slice.dotColor}
                      strokeWidth="16"
                      strokeDasharray={`${slice.strokeLength} ${circumference}`}
                      strokeDashoffset={-slice.offset}
                    />
                  ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {completionRate}%
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  สำเร็จแล้ว
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-3">
              {statusSlices.map((slice) => (
                <div key={slice.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: slice.dotColor }}
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {slice.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {slice.count}
                    </span>
                    <span className="w-10 text-right text-slate-400">
                      {slice.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Priority & Space Breakdown */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            ปริมาณงานตามระดับความสำคัญ (Priority)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ช่วยให้ทีมจัดลำดับงานเร่งด่วนได้อย่างแม่นยำ
          </p>

          <div className="mt-5 space-y-4">
            {priorityStats.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold ${item.colorClass}`}>{item.label}</span>
                  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {item.count} งาน ({item.percentage}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.flagColor,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              เชื่อมต่อ Issue จาก GitHub แล้ว {githubLinkedCount} รายการ
            </span>
            <button
              type="button"
              onClick={onOpenGitHub}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              <GitBranch className="h-3.5 w-3.5" />
              จัดการซิงก์ GitHub
            </button>
          </div>
        </section>
      </div>

      {/* Bottom Row: Team Workload Table + Real-Time Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Team Workload */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              ภาระงานและความคืบหน้ารายบุคคล
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pl-5 pr-3">สมาชิก</th>
                  <th className="py-2.5 px-3 text-right">ทั้งหมด</th>
                  <th className="py-2.5 px-3 text-right">เสร็จแล้ว</th>
                  <th className="py-2.5 px-3 text-right">กำลังทำ</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">อัตราสำเร็จ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {members.map((member) => {
                  const memberTasks = tasks.filter((t) =>
                    getTaskAssigneeIds(t).includes(member.id)
                  );
                  const doneCount = memberTasks.filter((t) => t.status === 'done').length;
                  const activeCount = memberTasks.length - doneCount;
                  const pct =
                    memberTasks.length > 0 ? Math.round((doneCount / memberTasks.length) * 100) : 0;

                  return (
                    <tr key={member.id} className="h-11">
                      <td className="pl-5 pr-3">
                        <MemberAvatar member={member} size="sm" showName />
                      </td>
                      <td className="px-3 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        {memberTasks.length}
                      </td>
                      <td className="px-3 text-right font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                        {doneCount}
                      </td>
                      <td className="px-3 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {activeCount}
                      </td>
                      <td className="pl-3 pr-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-9 font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Live Activity Feed */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              ความเคลื่อนไหวล่าสุด (เรียลไทม์)
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto kanban-scroll">
            {activities.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">
                ยังไม่มีกิจกรรมล่าสุด
              </p>
            ) : (
              activities.slice(0, 12).map((act) => {
                const matchingTask = tasks.find((t) => t.title === act.targetTitle);
                return (
                  <div key={act.id} className="px-5 py-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {act.actorName}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-slate-400">
                        {formatRelativeTime(act.createdAt)}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {act.action}{' '}
                      {matchingTask ? (
                        <button
                          type="button"
                          onClick={() => onSelectTask(matchingTask)}
                          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400 text-left"
                        >
                          {act.targetTitle}
                        </button>
                      ) : (
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {act.targetTitle}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
