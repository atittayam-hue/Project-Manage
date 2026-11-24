import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActiveClient,
  ProjectSpace,
  TaskItem,
  TaskPriority,
  TaskStatus,
  TeamMember,
  WorkspaceState,
  WsServerEvent,
} from '../types';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting';

export function useWorkspaceSocket(activeMemberId: string) {
  const [state, setState] = useState<WorkspaceState>({
    spaces: [],
    tasks: [],
    members: [],
    activities: [],
  });
  const [loading, setLoading] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [activeClients, setActiveClients] = useState<ActiveClient[]>([]);
  const [clientId, setClientId] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const activeMemberRef = useRef(activeMemberId);

  useEffect(() => {
    activeMemberRef.current = activeMemberId;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'presence:identify',
          memberId: activeMemberId,
        })
      );
    }
  }, [activeMemberId]);

  const applyServerEvent = useCallback((event: WsServerEvent) => {
    switch (event.type) {
      case 'init': {
        setState(event.state);
        setActiveClients(event.activeClients);
        setClientId(event.clientId);
        setLoading(false);
        break;
      }
      case 'presence:update': {
        setActiveClients(event.activeClients);
        break;
      }
      case 'task:created': {
        setState((prev) => {
          const exists = prev.tasks.some((t) => t.id === event.task.id);
          const nextTasks = exists
            ? prev.tasks.map((t) => (t.id === event.task.id ? event.task : t))
            : [...prev.tasks, event.task];
          const nextActivities =
            event.activity && !prev.activities.some((a) => a.id === event.activity!.id)
              ? [event.activity, ...prev.activities].slice(0, 40)
              : prev.activities;
          return { ...prev, tasks: nextTasks, activities: nextActivities };
        });
        break;
      }
      case 'task:updated': {
        setState((prev) => {
          const nextTasks = prev.tasks.map((t) => (t.id === event.task.id ? event.task : t));
          const nextActivities =
            event.activity && !prev.activities.some((a) => a.id === event.activity!.id)
              ? [event.activity, ...prev.activities].slice(0, 40)
              : prev.activities;
          return { ...prev, tasks: nextTasks, activities: nextActivities };
        });
        break;
      }
      case 'task:moved': {
        const orderMap = new Map(event.tasksOrder.map((o) => [o.id, o]));
        setState((prev) => {
          const nextTasks = prev.tasks.map((t) => {
            if (t.id === event.task.id) return event.task;
            const ord = orderMap.get(t.id);
            return ord ? { ...t, status: ord.status, order: ord.order } : t;
          });
          const nextActivities =
            event.activity && !prev.activities.some((a) => a.id === event.activity!.id)
              ? [event.activity, ...prev.activities].slice(0, 40)
              : prev.activities;
          return { ...prev, tasks: nextTasks, activities: nextActivities };
        });
        break;
      }
      case 'task:deleted': {
        setState((prev) => {
          const nextTasks = prev.tasks.filter((t) => t.id !== event.taskId);
          const nextActivities =
            event.activity && !prev.activities.some((a) => a.id === event.activity!.id)
              ? [event.activity, ...prev.activities].slice(0, 40)
              : prev.activities;
          return { ...prev, tasks: nextTasks, activities: nextActivities };
        });
        break;
      }
      case 'task:comment_added': {
        setState((prev) => {
          const nextTasks = prev.tasks.map((t) => {
            if (t.id !== event.taskId) return t;
            if (t.comments.some((c) => c.id === event.comment.id)) return t;
            return { ...t, comments: [...t.comments, event.comment] };
          });
          const nextActivities =
            event.activity && !prev.activities.some((a) => a.id === event.activity!.id)
              ? [event.activity, ...prev.activities].slice(0, 40)
              : prev.activities;
          return { ...prev, tasks: nextTasks, activities: nextActivities };
        });
        break;
      }
      case 'space:created': {
        setState((prev) => {
          if (prev.spaces.some((s) => s.id === event.space.id)) return prev;
          const nextActivities =
            event.activity && !prev.activities.some((a) => a.id === event.activity!.id)
              ? [event.activity, ...prev.activities].slice(0, 40)
              : prev.activities;
          return { ...prev, spaces: [...prev.spaces, event.space], activities: nextActivities };
        });
        break;
      }
      case 'space:updated': {
        setState((prev) => ({
          ...prev,
          spaces: prev.spaces.map((s) => (s.id === event.space.id ? event.space : s)),
        }));
        break;
      }
      case 'space:deleted': {
        setState((prev) => ({
          ...prev,
          spaces: prev.spaces.filter((s) => s.id !== event.spaceId),
          tasks: prev.tasks.filter((t) => t.spaceId !== event.spaceId),
        }));
        break;
      }
      case 'member:created': {
        setState((prev) => {
          if (prev.members.some((m) => m.id === event.member.id)) return prev;
          return { ...prev, members: [...prev.members, event.member] };
        });
        break;
      }
      case 'member:deleted': {
        setState((prev) => ({
          ...prev,
          members: prev.members.filter((m) => m.id !== event.memberId),
          tasks: prev.tasks.map((t) => {
            const nextIds = (t.assigneeIds || (t.assigneeId ? [t.assigneeId] : [])).filter(
              (id) => id !== event.memberId
            );
            return {
              ...t,
              assigneeIds: nextIds,
              assigneeId: nextIds[0] || '',
            };
          }),
        }));
        break;
      }
      case 'workspace:reset': {
        setState(event.state);
        break;
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        reconnectAttemptsRef.current = 0;
        setConnectionState('connected');
        setErrorBanner(null);
        ws.send(
          JSON.stringify({
            type: 'presence:identify',
            memberId: activeMemberRef.current,
          })
        );
      };

      ws.onmessage = (msg) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(msg.data as string) as WsServerEvent;
          applyServerEvent(parsed);
        } catch {
          // Ignore malformed message
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnectionState('reconnecting');
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 10_000);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    // Initial HTTP fetch fallback in case WS takes a moment
    fetch('/api/workspace')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.state && !cancelled) {
          setState(data.state);
          setActiveClients(data.activeClients || []);
          setLoading(false);
        }
      })
      .catch(() => {
        // WS will deliver initial state
      });

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [applyServerEvent]);

  const currentActorName =
    state.members.find((m) => m.id === activeMemberId)?.name || 'สมาชิกทีม';

  const createTask = useCallback(
    async (input: {
      spaceId: string;
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string;
      assigneeIds?: string[];
      dueDate?: string;
      tags?: string[];
    }) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, actorName: currentActorName }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorBanner(err.error || 'สร้างงานไม่สำเร็จ');
        throw new Error(err.error || 'Failed to create task');
      }
      const data = (await res.json()) as { task: TaskItem };
      return data.task;
    },
    [currentActorName]
  );

  const updateTask = useCallback(
    async (taskId: string, patch: Partial<TaskItem>) => {
      const snapshot = state.tasks;
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
      }));

      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, actorName: currentActorName }),
      });

      if (!res.ok) {
        setState((prev) => ({ ...prev, tasks: snapshot }));
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorBanner(err.error || 'บันทึกการแก้ไขไม่สำเร็จ');
        throw new Error(err.error || 'Failed to update task');
      }
    },
    [state.tasks, currentActorName]
  );

  const moveTask = useCallback(
    async (taskId: string, targetStatus: TaskStatus, targetIndex?: number) => {
      const snapshot = state.tasks;

      // Optimistic local reorder
      setState((prev) => {
        const moving = prev.tasks.find((t) => t.id === taskId);
        if (!moving) return prev;
        const updatedMoving = { ...moving, status: targetStatus };
        const destTasks = prev.tasks
          .filter((t) => t.status === targetStatus && t.id !== taskId)
          .sort((a, b) => a.order - b.order);

        const idx =
          typeof targetIndex === 'number' && targetIndex >= 0
            ? Math.min(targetIndex, destTasks.length)
            : destTasks.length;

        destTasks.splice(idx, 0, updatedMoving);
        const destOrderMap = new Map(destTasks.map((t, i) => [t.id, i]));

        return {
          ...prev,
          tasks: prev.tasks.map((t) => {
            if (t.id === taskId) {
              return { ...t, status: targetStatus, order: destOrderMap.get(t.id) ?? idx };
            }
            const nextOrd = destOrderMap.get(t.id);
            return nextOrd !== undefined ? { ...t, order: nextOrd } : t;
          }),
        };
      });

      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          targetIndex,
          actorName: currentActorName,
        }),
      });

      if (!res.ok) {
        setState((prev) => ({ ...prev, tasks: snapshot }));
        setErrorBanner('ย้ายสถานะงานไม่สำเร็จ');
      }
    },
    [state.tasks, currentActorName]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const snapshot = state.tasks;
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
      }));

      const res = await fetch(
        `/api/tasks/${encodeURIComponent(taskId)}?actorName=${encodeURIComponent(currentActorName)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        setState((prev) => ({ ...prev, tasks: snapshot }));
        setErrorBanner('ลบงานไม่สำเร็จ');
      }
    },
    [state.tasks, currentActorName]
  );

  const addComment = useCallback(
    async (taskId: string, text: string, mentions?: string[]) => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, authorId: activeMemberId, mentions }),
      });
      if (!res.ok) {
        setErrorBanner('ส่งความคิดเห็นไม่สำเร็จ');
        throw new Error('Failed to post comment');
      }
    },
    [activeMemberId]
  );

  const createMember = useCallback(async (input: { name: string; role: string }) => {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorBanner(err.error || 'เพิ่มสมาชิกไม่สำเร็จ');
      throw new Error(err.error || 'Failed to create member');
    }
    const data = (await res.json()) as { member: TeamMember };
    return data.member;
  }, []);

  const createSpace = useCallback(
    async (input: { name: string; key: string; description: string; color: string; githubRepo?: string }) => {
      const res = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, actorName: currentActorName }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorBanner(err.error || 'สร้างโปรเจกต์ไม่สำเร็จ');
        throw new Error(err.error || 'Failed to create space');
      }
      const data = (await res.json()) as { space: ProjectSpace };
      return data.space;
    },
    [currentActorName]
  );

  const deleteSpace = useCallback(async (spaceId: string) => {
    const res = await fetch(`/api/spaces/${encodeURIComponent(spaceId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorBanner(err.error || 'ลบโปรเจกต์ไม่สำเร็จ');
    }
  }, []);

  const deleteMember = useCallback(async (memberId: string) => {
    const res = await fetch(`/api/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorBanner(err.error || 'ลบสมาชิกไม่สำเร็จ');
    }
  }, []);

  const resetWorkspace = useCallback(async () => {
    const res = await fetch('/api/workspace/reset', {
      method: 'POST',
    });
    if (!res.ok) {
      setErrorBanner('ล้างข้อมูลไม่สำเร็จ');
    }
  }, []);

  return {
    state,
    loading,
    connectionState,
    activeClients,
    clientId,
    errorBanner,
    clearError: () => setErrorBanner(null),
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    addComment,
    createMember,
    deleteMember,
    createSpace,
    deleteSpace,
    resetWorkspace,
  };
}
