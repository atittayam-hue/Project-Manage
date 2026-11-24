import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BellRing, X } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { CreateSpaceModal } from './components/CreateSpaceModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { DashboardView } from './components/DashboardView';
import { GitHubIntegrationView } from './components/GitHubIntegrationView';
import { KanbanBoard } from './components/KanbanBoard';
import { ListView } from './components/ListView';
import { Sidebar } from './components/Sidebar';
import { TaskDetailModal } from './components/TaskDetailModal';
import { TeamInviteModal } from './components/TeamInviteModal';
import { TopBar } from './components/TopBar';
import { getTaskAssigneeIds } from './constants';
import { useWorkspaceSocket } from './hooks/useWorkspaceSocket';
import type {
  AppNotification,
  GitHubUser,
  TaskItem,
  TaskPriority,
  TaskStatus,
  TeamMember,
  ViewMode,
} from './types';
import { downloadTextFile, exportWorkspaceJson, generateGitHubMarkdown } from './utils/exportWorkspace';

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [ownerNeedsClaim, setOwnerNeedsClaim] = useState(false);

  const [inviteParams] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || '';
    const join = params.get('join') === '1';
    return {
      email,
      mode: (join || email ? 'register' : 'login') as 'login' | 'register',
    };
  });

  const [activeSpaceId, setActiveSpaceId] = useState<string | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'all'>('all');
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const [teamInviteOpen, setTeamInviteOpen] = useState(false);

  // GitHub session held strictly in React memory (never persisted in localStorage)
  const [githubSessionToken, setGithubSessionToken] = useState<string | null>(null);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  const refreshAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = (await res.json()) as { ownerNeedsClaim?: boolean };
        setOwnerNeedsClaim(Boolean(data.ownerNeedsClaim));
      }
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    void refreshAuthStatus();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const {
    state,
    notifications,
    latestToast,
    dismissToast,
    loading,
    connectionState,
    activeClients,
    errorBanner,
    clearError,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    addComment,
    createMember,
    deleteMember,
    createSpace,
    markNotificationRead,
    markAllNotificationsRead,
    resetWorkspace,
  } = useWorkspaceSocket(authToken, currentUser?.id || '');

  // Keep activeSpaceId valid if workspace resets
  useEffect(() => {
    if (loading || !authToken) return;
    if (activeSpaceId !== 'all' && !state.spaces.some((s) => s.id === activeSpaceId)) {
      setActiveSpaceId('all');
    }
  }, [loading, authToken, state.spaces, activeSpaceId]);

  // Sync currentUser profile if updated in workspace members list
  const resolvedCurrentUser = useMemo(() => {
    if (!currentUser) return null;
    return state.members.find((m) => m.id === currentUser.id) || currentUser;
  }, [currentUser, state.members]);

  const activeSpace = useMemo(
    () => (activeSpaceId === 'all' ? undefined : state.spaces.find((s) => s.id === activeSpaceId)),
    [activeSpaceId, state.spaces]
  );

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.tasks.filter((task) => {
      if (activeSpaceId !== 'all' && task.spaceId !== activeSpaceId) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (assigneeFilter !== 'all' && !getTaskAssigneeIds(task).includes(assigneeFilter)) {
        return false;
      }
      if (q) {
        const hay = `${task.code} ${task.title} ${task.description} ${task.tags.join(' ')} #${task.githubIssueNumber || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state.tasks, activeSpaceId, priorityFilter, assigneeFilter, searchQuery]);

  const filteredActivities = useMemo(() => {
    if (activeSpaceId === 'all') return state.activities;
    return state.activities.filter((a) => a.spaceId === activeSpaceId);
  }, [state.activities, activeSpaceId]);

  const selectedTask: TaskItem | null = useMemo(
    () => (selectedTaskId ? state.tasks.find((t) => t.id === selectedTaskId) || null : null),
    [selectedTaskId, state.tasks]
  );

  const handleLogout = async () => {
    if (authToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => undefined);
    }
    setAuthToken(null);
    setCurrentUser(null);
    setSelectedTaskId(null);
    setActiveSpaceId('all');
    void refreshAuthStatus();
  };

  const handleQuickCreateTask = async (status: TaskStatus, title: string) => {
    const targetSpaceId =
      activeSpaceId !== 'all' ? activeSpaceId : state.spaces[0]?.id || 'space-main';
    await createTask({
      spaceId: targetSpaceId,
      title,
      status,
      priority: 'normal',
      assigneeId: resolvedCurrentUser?.id || '',
    });
  };

  const handleSelectNotification = (notification: AppNotification) => {
    if (!notification.read) {
      void markNotificationRead(notification.id);
    }
    if (state.tasks.some((t) => t.id === notification.taskId)) {
      setSelectedTaskId(notification.taskId);
    }
  };

  if (authChecking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400 text-sm">
        กำลังตรวจสอบสถานะพื้นที่ทำงาน...
      </div>
    );
  }

  if (!authToken || !resolvedCurrentUser) {
    return (
      <AuthScreen
        ownerNeedsClaim={ownerNeedsClaim}
        initialEmail={inviteParams.email}
        initialMode={inviteParams.mode}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        onAuthenticated={(token, member) => {
          setOwnerNeedsClaim(false);
          setAuthToken(token);
          setCurrentUser(member);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        spaces={state.spaces}
        tasks={state.tasks}
        members={state.members}
        activeClients={activeClients}
        currentUser={resolvedCurrentUser}
        onLogout={() => void handleLogout()}
        activeSpaceId={activeSpaceId}
        onSelectSpace={setActiveSpaceId}
        viewMode={viewMode}
        onSelectView={setViewMode}
        connectionState={connectionState}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        onOpenCreateSpace={() => setCreateSpaceOpen(true)}
        onOpenTeamInvite={() => setTeamInviteOpen(true)}
        onExportMarkdown={() => {
          const md = generateGitHubMarkdown(state, activeSpaceId);
          downloadTextFile('TASKS.md', md, 'text/markdown;charset=utf-8');
        }}
        onExportJson={() => exportWorkspaceJson(state, activeSpace)}
        onResetWorkspace={async () => {
          await resetWorkspace();
          setActiveSpaceId('all');
          setSelectedTaskId(null);
        }}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex flex-1 min-w-0 flex-col h-full">
        <TopBar
          activeSpace={activeSpace}
          members={state.members}
          notifications={notifications}
          viewMode={viewMode}
          onSelectView={setViewMode}
          searchQuery={searchQuery}
          onChangeSearch={setSearchQuery}
          priorityFilter={priorityFilter}
          onChangePriorityFilter={setPriorityFilter}
          assigneeFilter={assigneeFilter}
          onChangeAssigneeFilter={setAssigneeFilter}
          onSelectNotification={handleSelectNotification}
          onMarkAllNotificationsRead={() => void markAllNotificationsRead()}
          onOpenCreateTask={() => setCreateTaskOpen(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Mobile View Switcher Bar */}
        <div className="flex md:hidden items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 w-full">
            {(
              [
                { id: 'kanban', label: 'คัมบัง' },
                { id: 'list', label: 'รายการ' },
                { id: 'dashboard', label: 'แดชบอร์ด' },
                { id: 'github', label: 'GitHub' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewMode === tab.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {errorBanner && (
          <div className="flex items-center justify-between gap-3 bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorBanner}
            </span>
            <button type="button" onClick={clearError} aria-label="ปิดการแจ้งเตือน">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <main className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="grid h-full grid-cols-1 md:grid-cols-4 gap-4 p-6">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-white/60 p-4 space-y-3 animate-pulse dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800/70" />
                  <div className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800/70" />
                </div>
              ))}
            </div>
          ) : viewMode === 'kanban' ? (
            <KanbanBoard
              tasks={filteredTasks}
              spaces={state.spaces}
              members={state.members}
              activeSpaceId={activeSpaceId}
              onMoveTask={moveTask}
              onUpdateTask={updateTask}
              onCreateMember={createMember}
              onSelectTask={(task) => setSelectedTaskId(task.id)}
              onQuickCreateTask={handleQuickCreateTask}
            />
          ) : viewMode === 'list' ? (
            <ListView
              tasks={filteredTasks}
              spaces={state.spaces}
              members={state.members}
              onSelectTask={(task) => setSelectedTaskId(task.id)}
              onUpdateTask={updateTask}
              onMoveTask={(taskId, targetStatus) => moveTask(taskId, targetStatus)}
              onCreateMember={createMember}
            />
          ) : viewMode === 'dashboard' ? (
            <DashboardView
              tasks={filteredTasks}
              spaces={activeSpace ? [activeSpace] : state.spaces}
              members={state.members}
              activities={filteredActivities}
              onSelectTask={(task) => setSelectedTaskId(task.id)}
              onOpenGitHub={() => setViewMode('github')}
            />
          ) : (
            <GitHubIntegrationView
              workspaceState={state}
              spaces={state.spaces}
              tasks={state.tasks}
              activeSpaceId={activeSpaceId}
              activeActorName={resolvedCurrentUser.name}
              authToken={authToken}
              githubSessionToken={githubSessionToken}
              githubUser={githubUser}
              onGitHubConnected={(token, user) => {
                setGithubSessionToken(token);
                setGithubUser(user);
              }}
              onGitHubDisconnected={() => {
                setGithubSessionToken(null);
                setGithubUser(null);
              }}
              onTasksImported={() => setViewMode('kanban')}
            />
          )}
        </main>
      </div>

      {/* Real-Time Tag Notification Toast */}
      {latestToast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-indigo-200 bg-white p-4 shadow-xl dark:border-indigo-900 dark:bg-slate-900"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <BellRing className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {latestToast.actorName} · {latestToast.message}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                {latestToast.taskCode} · {latestToast.taskTitle}
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectNotification(latestToast);
                    dismissToast();
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  เปิดดูงาน
                </button>
                <button
                  type="button"
                  onClick={dismissToast}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ปิด
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissToast}
              aria-label="ปิดการแจ้งเตือน"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <TaskDetailModal
        task={selectedTask}
        spaces={state.spaces}
        members={state.members}
        authToken={authToken}
        githubSessionToken={githubSessionToken}
        githubUser={githubUser}
        onClose={() => setSelectedTaskId(null)}
        onUpdateTask={updateTask}
        onMoveTask={(taskId, status) => moveTask(taskId, status)}
        onDeleteTask={deleteTask}
        onAddComment={addComment}
        onCreateMember={createMember}
        onOpenGitHubSettings={() => setViewMode('github')}
      />

      <CreateTaskModal
        open={createTaskOpen}
        spaces={state.spaces}
        members={state.members}
        defaultSpaceId={activeSpaceId !== 'all' ? activeSpaceId : state.spaces[0]?.id || ''}
        defaultAssigneeId={resolvedCurrentUser.id}
        onClose={() => setCreateTaskOpen(false)}
        onCreateMember={createMember}
        onCreate={createTask}
      />

      <CreateSpaceModal
        open={createSpaceOpen}
        onClose={() => setCreateSpaceOpen(false)}
        onCreate={async (input) => {
          const created = await createSpace(input);
          setActiveSpaceId(created.id);
        }}
      />

      <TeamInviteModal
        open={teamInviteOpen}
        members={state.members}
        activeClients={activeClients}
        activeMemberId={resolvedCurrentUser.id}
        onClose={() => setTeamInviteOpen(false)}
        onCreateMember={createMember}
        onDeleteMember={deleteMember}
      />
    </div>
  );
}
