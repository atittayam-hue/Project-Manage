import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  ActiveClient,
  ActivityLog,
  AppNotification,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepoInfo,
  GitHubUser,
  ProjectSpace,
  Subtask,
  TaskComment,
  TaskItem,
  TaskPriority,
  TaskStatus,
  TeamMember,
  WorkspaceState,
  WsServerEvent,
} from './src/types.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'workspace.json');

const VALID_STATUSES: ReadonlyArray<TaskStatus> = ['todo', 'in_progress', 'review', 'done'];
const VALID_PRIORITIES: ReadonlyArray<TaskPriority> = ['urgent', 'high', 'normal', 'low'];
const REPO_PATTERN = /^[a-zA-Z0-9_.-]{1,100}\/[a-zA-Z0-9_.-]{1,100}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredMember extends TeamMember {
  passwordHash?: string;
}

interface StoredWorkspaceState {
  spaces: ProjectSpace[];
  tasks: TaskItem[];
  members: StoredMember[];
  activities: ActivityLog[];
  notifications: AppNotification[];
}

function isValidRepoSlug(repo: string): boolean {
  if (!REPO_PATTERN.test(repo)) return false;
  const parts = repo.split('/');
  return !parts.some((p) => p === '.' || p === '..');
}

function isSafeHttpUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 160);
}

function isValidEmail(email: string): boolean {
  return Boolean(email && email.length <= 160 && EMAIL_PATTERN.test(email));
}

function computeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || 'US';
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function sanitizeMember(member: StoredMember): TeamMember {
  return {
    id: member.id,
    name: member.name,
    email: member.email || '',
    role: member.role,
    avatarUrl: member.avatarUrl || '',
    initials: member.initials,
    status: member.passwordHash ? 'active' : 'invited',
  };
}

function buildUserWorkspaceState(state: StoredWorkspaceState, memberId: string): WorkspaceState {
  return {
    spaces: state.spaces,
    tasks: state.tasks,
    members: state.members.map(sanitizeMember),
    activities: state.activities,
    notifications: state.notifications.filter((n) => n.recipientId === memberId),
  };
}

function createInitialState(): StoredWorkspaceState {
  const now = new Date().toISOString();

  const members: StoredMember[] = [
    {
      id: 'm-owner',
      name: 'ผู้ดูแลพื้นที่ (Owner)',
      email: '',
      role: 'Project Owner',
      avatarUrl: '',
      initials: 'OW',
      status: 'invited',
    },
  ];

  const spaces: ProjectSpace[] = [
    {
      id: 'space-main',
      name: 'โปรเจกต์หลัก (Main Project)',
      key: 'PRJ',
      description: 'พื้นที่ทำงานหลักสำหรับจัดการงานและติดตามสถานะ',
      color: '#4F46E5',
      createdAt: now,
    },
  ];

  return { spaces, tasks: [], members, activities: [], notifications: [] };
}

function loadWorkspaceState(): StoredWorkspaceState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoredWorkspaceState>;
      if (
        parsed &&
        Array.isArray(parsed.spaces) &&
        Array.isArray(parsed.tasks) &&
        Array.isArray(parsed.members)
      ) {
        return {
          spaces: parsed.spaces,
          tasks: parsed.tasks.map((t) => ({
            ...t,
            assigneeIds:
              Array.isArray(t.assigneeIds)
                ? t.assigneeIds
                : t.assigneeId
                  ? [t.assigneeId]
                  : [],
          })),
          members: parsed.members.map((m) => ({
            ...m,
            email: typeof m.email === 'string' ? normalizeEmail(m.email) : '',
            status: m.passwordHash ? 'active' : 'invited',
          })),
          activities: Array.isArray(parsed.activities) ? parsed.activities : [],
          notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        };
      }
    }
  } catch (err) {
    console.error('Failed to load workspace state, initializing default:', err);
  }
  const initial = createInitialState();
  persistWorkspaceState(initial);
  return initial;
}

function persistWorkspaceState(state: StoredWorkspaceState) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = path.resolve(DATA_DIR, 'workspace.tmp.json');
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch (err) {
    console.error('Failed to persist workspace state:', err);
  }
}

function getAppUrl(req?: express.Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (req) {
    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    if (host) return `${proto}://${host}`;
  }
  return `http://localhost:${PORT}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const state: StoredWorkspaceState = loadWorkspaceState();

  // In-memory workspace auth sessions (never persisted to disk)
  const authSessions = new Map<string, { memberId: string; expiresAt: number }>();
  // In-memory GitHub OAuth & PAT session store (never persisted to disk)
  const githubSessions = new Map<string, { accessToken: string; user: GitHubUser }>();
  // In-memory OAuth CSRF state tokens (expire in 10 minutes)
  const oauthStates = new Map<string, number>();

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<WebSocket, ActiveClient>();

  function getActiveClientsList(): ActiveClient[] {
    return Array.from(clients.values());
  }

  function broadcast(event: WsServerEvent) {
    const payload = JSON.stringify(event);
    for (const [socket] of clients) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  function sendToMember(memberId: string, event: WsServerEvent) {
    const payload = JSON.stringify(event);
    for (const [socket, client] of clients) {
      if (client.memberId === memberId && socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  function createAuthSession(memberId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    authSessions.set(token, {
      memberId,
      expiresAt: Date.now() + AUTH_SESSION_TTL_MS,
    });
    return token;
  }

  function getWorkspaceAuthMember(req: express.Request): StoredMember | null {
    const auth = req.headers.authorization;
    const rawHeader =
      auth && auth.startsWith('Bearer ')
        ? auth.slice(7).trim()
        : typeof req.headers['x-workspace-token'] === 'string'
          ? req.headers['x-workspace-token'].trim()
          : '';
    if (!rawHeader) return null;
    const session = authSessions.get(rawHeader);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      authSessions.delete(rawHeader);
      return null;
    }
    const member = state.members.find((m) => m.id === session.memberId);
    if (!member) {
      authSessions.delete(rawHeader);
      return null;
    }
    return member;
  }

  function requireAuth(req: express.Request, res: express.Response): StoredMember | null {
    const member = getWorkspaceAuthMember(req);
    if (!member) {
      res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วยอีเมลก่อนใช้งาน' });
      return null;
    }
    return member;
  }

  function recordActivity(actorName: string, action: string, targetTitle: string, spaceId: string): ActivityLog {
    const activity: ActivityLog = {
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      actorName,
      action,
      targetTitle,
      spaceId,
      createdAt: new Date().toISOString(),
    };
    state.activities = [activity, ...state.activities].slice(0, 40);
    return activity;
  }

  function pushNotification(params: {
    recipientId: string;
    actor: StoredMember;
    type: 'task_assigned' | 'comment_mention';
    task: TaskItem;
    message: string;
  }) {
    if (!params.recipientId || params.recipientId === params.actor.id) return;
    const recipientExists = state.members.some((m) => m.id === params.recipientId);
    if (!recipientExists) return;

    const notification: AppNotification = {
      id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
      recipientId: params.recipientId,
      actorId: params.actor.id,
      actorName: params.actor.name,
      type: params.type,
      taskId: params.task.id,
      taskCode: params.task.code,
      taskTitle: params.task.title,
      spaceId: params.task.spaceId,
      message: params.message,
      read: false,
      createdAt: new Date().toISOString(),
    };
    state.notifications = [notification, ...state.notifications].slice(0, 300);
    sendToMember(params.recipientId, { type: 'notification:created', notification });
  }

  function ownerNeedsClaim(): boolean {
    return state.members.length === 1 && !state.members[0].passwordHash && !state.members[0].email;
  }

  wss.on('connection', (ws) => {
    const clientId = crypto.randomUUID().slice(0, 8);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; token?: string };
        if (msg.type === 'auth' && typeof msg.token === 'string') {
          const session = authSessions.get(msg.token.trim());
          if (!session || Date.now() > session.expiresAt) {
            ws.close(4001, 'Unauthorized');
            return;
          }
          const member = state.members.find((m) => m.id === session.memberId);
          if (!member) {
            ws.close(4001, 'Unauthorized');
            return;
          }
          const clientInfo: ActiveClient = {
            clientId,
            memberId: member.id,
            name: member.name,
            joinedAt: new Date().toISOString(),
          };
          clients.set(ws, clientInfo);

          const initPayload: WsServerEvent = {
            type: 'init',
            state: buildUserWorkspaceState(state, member.id),
            notifications: state.notifications.filter((n) => n.recipientId === member.id),
            activeClients: getActiveClientsList(),
            clientId,
          };
          ws.send(JSON.stringify(initPayload));
          broadcast({ type: 'presence:update', activeClients: getActiveClientsList() });
        }
      } catch {
        // Ignore malformed WS payloads
      }
    });

    ws.on('close', () => {
      if (clients.delete(ws)) {
        broadcast({ type: 'presence:update', activeClients: getActiveClientsList() });
      }
    });
  });

  // Helper to read GitHub session token for GitHub proxy routes
  function getGitHubSession(req: express.Request) {
    const ghHeader =
      typeof req.headers['x-github-session'] === 'string'
        ? req.headers['x-github-session'].trim()
        : '';
    if (ghHeader) {
      return githubSessions.get(ghHeader) || null;
    }
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.slice(7).trim();
      return githubSessions.get(token) || null;
    }
    return null;
  }

  // --- Health & Auth API ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, clients: clients.size });
  });

  app.get('/api/auth/status', (_req, res) => {
    res.json({
      ownerNeedsClaim: ownerNeedsClaim(),
      memberCount: state.members.length,
    });
  });

  app.post('/api/auth/claim-owner', (req, res) => {
    if (!ownerNeedsClaim()) {
      res.status(409).json({ error: 'บัญชีผู้ดูแลพื้นที่ถูกตั้งค่าไว้แล้ว กรุณาเข้าสู่ระบบด้วยอีเมล' });
      return;
    }
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };
    const cleanEmail = typeof email === 'string' ? normalizeEmail(email) : '';
    if (!isValidEmail(cleanEmail)) {
      res.status(400).json({ error: 'กรุณาระบุอีเมลที่ถูกต้อง' });
      return;
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'กรุณาระบุชื่อผู้ใช้งาน' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
      return;
    }

    const owner = state.members[0];
    owner.name = name.trim().slice(0, 60);
    owner.email = cleanEmail;
    owner.role = typeof role === 'string' && role.trim() ? role.trim().slice(0, 60) : 'Project Owner';
    owner.initials = computeInitials(owner.name);
    owner.passwordHash = hashPassword(password);
    owner.status = 'active';

    persistWorkspaceState(state);
    const sessionToken = createAuthSession(owner.id);
    res.status(201).json({ sessionToken, member: sanitizeMember(owner) });
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    const cleanEmail = typeof email === 'string' ? normalizeEmail(email) : '';
    if (!isValidEmail(cleanEmail)) {
      res.status(400).json({ error: 'กรุณาระบุอีเมลที่ถูกต้อง' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
      return;
    }

    const existing = state.members.find((m) => m.email === cleanEmail);
    if (existing) {
      if (existing.passwordHash) {
        res.status(409).json({ error: 'อีเมลนี้ลงทะเบียนไว้แล้ว กรุณาเข้าสู่ระบบด้วยอีเมล' });
        return;
      }
      // Activate invited member while preserving their member ID, tasks, and pending notifications
      if (typeof name === 'string' && name.trim()) {
        existing.name = name.trim().slice(0, 60);
        existing.initials = computeInitials(existing.name);
      }
      if (typeof role === 'string' && role.trim()) {
        existing.role = role.trim().slice(0, 60);
      }
      existing.passwordHash = hashPassword(password);
      existing.status = 'active';

      persistWorkspaceState(state);
      const safeMember = sanitizeMember(existing);
      broadcast({ type: 'member:updated', member: safeMember });
      const sessionToken = createAuthSession(existing.id);
      res.status(201).json({ sessionToken, member: safeMember });
      return;
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'กรุณาระบุชื่อของคุณ' });
      return;
    }

    const trimmedName = name.trim().slice(0, 60);
    const newMember: StoredMember = {
      id: `m-${crypto.randomUUID().slice(0, 8)}`,
      name: trimmedName,
      email: cleanEmail,
      role: typeof role === 'string' && role.trim() ? role.trim().slice(0, 60) : 'Team Member',
      avatarUrl: '',
      initials: computeInitials(trimmedName),
      passwordHash: hashPassword(password),
      status: 'active',
    };

    state.members.push(newMember);
    persistWorkspaceState(state);
    const safeMember = sanitizeMember(newMember);
    broadcast({ type: 'member:created', member: safeMember });
    const sessionToken = createAuthSession(newMember.id);
    res.status(201).json({ sessionToken, member: safeMember });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanEmail = typeof email === 'string' ? normalizeEmail(email) : '';
    if (!isValidEmail(cleanEmail) || !password || typeof password !== 'string') {
      res.status(400).json({ error: 'กรุณาระบุอีเมลและรหัสผ่าน' });
      return;
    }

    const member = state.members.find((m) => m.email === cleanEmail);
    if (!member) {
      res.status(401).json({ error: 'ไม่พบบัญชีอีเมลนี้ในระบบ กรุณาลงทะเบียนใหม่' });
      return;
    }
    if (!member.passwordHash) {
      res.status(403).json({
        code: 'NEEDS_PASSWORD_SETUP',
        memberName: member.name,
        memberRole: member.role,
        error: 'อีเมลนี้ถูกเพิ่มเข้าทีมไว้แล้ว กรุณาตั้งรหัสผ่านสำหรับเข้าใช้งานครั้งแรก',
      });
      return;
    }
    if (!verifyPassword(password, member.passwordHash)) {
      res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    const sessionToken = createAuthSession(member.id);
    res.json({ sessionToken, member: sanitizeMember(member) });
  });

  app.get('/api/auth/me', (req, res) => {
    const member = requireAuth(req, res);
    if (!member) return;
    res.json({ member: sanitizeMember(member) });
  });

  app.post('/api/auth/logout', (req, res) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      authSessions.delete(auth.slice(7).trim());
    }
    res.json({ ok: true });
  });

  // --- Workspace API ---
  app.get('/api/workspace', (req, res) => {
    const member = requireAuth(req, res);
    if (!member) return;
    const userState = buildUserWorkspaceState(state, member.id);
    res.json({
      state: userState,
      notifications: userState.notifications || [],
      activeClients: getActiveClientsList(),
    });
  });

  app.post('/api/workspace/reset', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const fresh = createInitialState();
    state.spaces = fresh.spaces;
    state.tasks = fresh.tasks;
    state.activities = [];
    state.notifications = [];
    // Keep the currently authenticated user as Owner so their session stays intact
    authMember.role = authMember.role || 'Project Owner';
    state.members = [authMember];

    for (const [socket, client] of clients) {
      if (client.memberId !== authMember.id) {
        socket.close(4001, 'Workspace reset');
      }
    }

    persistWorkspaceState(state);
    const resetView = buildUserWorkspaceState(state, authMember.id);
    broadcast({ type: 'workspace:reset', state: resetView });
    broadcast({ type: 'presence:update', activeClients: getActiveClientsList() });
    res.json({ reset: true, state: resetView });
  });

  // --- Notifications ---
  app.patch('/api/notifications/:id/read', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const notification = state.notifications.find(
      (n) => n.id === req.params.id && n.recipientId === authMember.id
    );
    if (!notification) {
      res.status(404).json({ error: 'ไม่พบการแจ้งเตือน' });
      return;
    }
    notification.read = true;
    persistWorkspaceState(state);
    sendToMember(authMember.id, {
      type: 'notification:updated',
      notificationId: notification.id,
      read: true,
    });
    res.json({ notification });
  });

  app.post('/api/notifications/read-all', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    let changed = false;
    for (const n of state.notifications) {
      if (n.recipientId === authMember.id && !n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) {
      persistWorkspaceState(state);
      sendToMember(authMember.id, { type: 'notifications:read_all' });
    }
    res.json({ ok: true });
  });

  // --- Team Members ---
  app.post('/api/members', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const { name, email, role } = req.body as { name?: string; email?: string; role?: string };
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'กรุณาระบุชื่อสมาชิก' });
      return;
    }
    const cleanEmail = typeof email === 'string' ? normalizeEmail(email) : '';
    if (!isValidEmail(cleanEmail)) {
      res.status(400).json({ error: 'กรุณาระบุอีเมลของสมาชิกให้ถูกต้อง (เพื่อให้เข้าสู่ระบบและรับแจ้งเตือนได้)' });
      return;
    }
    if (state.members.some((m) => m.email === cleanEmail)) {
      res.status(409).json({ error: 'อีเมลนี้อยู่ในทีมเรียบร้อยแล้ว' });
      return;
    }

    const trimmedName = name.trim().slice(0, 60);
    const newMember: StoredMember = {
      id: `m-${crypto.randomUUID().slice(0, 8)}`,
      name: trimmedName,
      email: cleanEmail,
      role: typeof role === 'string' && role.trim() ? role.trim().slice(0, 60) : 'Team Member',
      avatarUrl: '',
      initials: computeInitials(trimmedName),
      status: 'invited',
    };

    state.members.push(newMember);
    persistWorkspaceState(state);
    const safeMember = sanitizeMember(newMember);
    broadcast({ type: 'member:created', member: safeMember });
    res.status(201).json({ member: safeMember });
  });

  app.delete('/api/members/:id', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    if (req.params.id === authMember.id) {
      res.status(400).json({ error: 'ไม่สามารถลบบัญชีที่คุณกำลังใช้งานอยู่ได้' });
      return;
    }
    if (state.members.length <= 1) {
      res.status(400).json({ error: 'ต้องมีสมาชิกอย่างน้อย 1 คนในพื้นที่ทำงาน' });
      return;
    }
    const idx = state.members.findIndex((m) => m.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'ไม่พบสมาชิก' });
      return;
    }
    const [removed] = state.members.splice(idx, 1);
    for (const task of state.tasks) {
      if (Array.isArray(task.assigneeIds)) {
        task.assigneeIds = task.assigneeIds.filter((id) => id !== removed.id);
        task.assigneeId = task.assigneeIds[0] || '';
      } else if (task.assigneeId === removed.id) {
        task.assigneeId = '';
      }
    }
    state.notifications = state.notifications.filter((n) => n.recipientId !== removed.id);
    for (const [token, session] of authSessions) {
      if (session.memberId === removed.id) authSessions.delete(token);
    }
    persistWorkspaceState(state);
    broadcast({ type: 'member:deleted', memberId: removed.id });
    res.json({ deleted: true });
  });

  // --- Spaces CRUD ---
  app.post('/api/spaces', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const { name, key, description, color, githubRepo } = req.body as {
      name?: string;
      key?: string;
      description?: string;
      color?: string;
      githubRepo?: string;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'กรุณาระบุชื่อโปรเจกต์' });
      return;
    }

    const cleanKey = (typeof key === 'string' && key.trim() ? key.trim() : name.trim().slice(0, 3))
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 5) || 'PRJ';

    const cleanRepo =
      typeof githubRepo === 'string' && githubRepo.trim() && isValidRepoSlug(githubRepo.trim())
        ? githubRepo.trim()
        : undefined;

    const newSpace: ProjectSpace = {
      id: `space-${crypto.randomUUID().slice(0, 8)}`,
      name: name.trim().slice(0, 80),
      key: cleanKey,
      description: typeof description === 'string' ? description.trim().slice(0, 240) : '',
      color: typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#4F46E5',
      githubRepo: cleanRepo,
      createdAt: new Date().toISOString(),
    };

    state.spaces.push(newSpace);
    const activity = recordActivity(
      authMember.name,
      'สร้างโปรเจกต์ใหม่',
      newSpace.name,
      newSpace.id
    );
    persistWorkspaceState(state);
    broadcast({ type: 'space:created', space: newSpace, activity });
    res.status(201).json({ space: newSpace });
  });

  app.patch('/api/spaces/:id', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const space = state.spaces.find((s) => s.id === req.params.id);
    if (!space) {
      res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
      return;
    }
    const { name, description, color, githubRepo } = req.body as Partial<ProjectSpace>;
    if (typeof name === 'string' && name.trim()) space.name = name.trim().slice(0, 80);
    if (typeof description === 'string') space.description = description.trim().slice(0, 240);
    if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) space.color = color;
    if (githubRepo !== undefined) {
      if (githubRepo === '' || githubRepo === null) {
        delete space.githubRepo;
      } else if (typeof githubRepo === 'string' && isValidRepoSlug(githubRepo.trim())) {
        space.githubRepo = githubRepo.trim();
      }
    }
    persistWorkspaceState(state);
    broadcast({ type: 'space:updated', space });
    res.json({ space });
  });

  app.delete('/api/spaces/:id', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    if (state.spaces.length <= 1) {
      res.status(400).json({ error: 'ต้องมีอย่างน้อย 1 โปรเจกต์ในพื้นที่ทำงาน' });
      return;
    }
    const idx = state.spaces.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
      return;
    }
    const [removed] = state.spaces.splice(idx, 1);
    state.tasks = state.tasks.filter((t) => t.spaceId !== removed.id);
    state.notifications = state.notifications.filter((n) => n.spaceId !== removed.id);
    persistWorkspaceState(state);
    broadcast({ type: 'space:deleted', spaceId: removed.id });
    res.json({ deleted: true });
  });

  // --- Tasks CRUD ---
  app.post('/api/tasks', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const body = req.body as {
      spaceId?: string;
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string;
      assigneeIds?: string[];
      dueDate?: string;
      tags?: string[];
      subtasks?: Subtask[];
      githubIssueNumber?: number;
      githubIssueUrl?: string;
      githubRepo?: string;
    };

    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      res.status(400).json({ error: 'กรุณาระบุชื่องาน' });
      return;
    }

    const space = state.spaces.find((s) => s.id === body.spaceId) || state.spaces[0];
    if (!space) {
      res.status(400).json({ error: 'ไม่พบโปรเจกต์ปลายทาง' });
      return;
    }

    const status: TaskStatus = VALID_STATUSES.includes(body.status as TaskStatus)
      ? (body.status as TaskStatus)
      : 'todo';
    const priority: TaskPriority = VALID_PRIORITIES.includes(body.priority as TaskPriority)
      ? (body.priority as TaskPriority)
      : 'normal';

    const existingCodes = state.tasks
      .filter((t) => t.spaceId === space.id)
      .map((t) => Number(t.code.split('-')[1] || 0))
      .filter((n) => !Number.isNaN(n));
    const nextNumber = (existingCodes.length > 0 ? Math.max(...existingCodes) : 0) + 1;

    const columnTasks = state.tasks.filter((t) => t.status === status);
    const maxOrder = columnTasks.reduce((acc, t) => Math.max(acc, t.order), -1);

    const validAssignees = Array.isArray(body.assigneeIds)
      ? Array.from(
          new Set(
            body.assigneeIds.filter(
              (id): id is string =>
                typeof id === 'string' && state.members.some((m) => m.id === id)
            )
          )
        )
      : typeof body.assigneeId === 'string' && state.members.some((m) => m.id === body.assigneeId)
        ? [body.assigneeId]
        : [authMember.id];

    const now = new Date().toISOString();
    const newTask: TaskItem = {
      id: `task-${crypto.randomUUID().slice(0, 8)}`,
      code: `${space.key}-${nextNumber}`,
      spaceId: space.id,
      title: body.title.trim().slice(0, 180),
      description: typeof body.description === 'string' ? body.description.trim().slice(0, 4000) : '',
      status,
      priority,
      assigneeId: validAssignees[0] || '',
      assigneeIds: validAssignees,
      dueDate:
        typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)
          ? body.dueDate
          : new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
      order: maxOrder + 1,
      tags: Array.isArray(body.tags)
        ? body.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim().slice(0, 24)).slice(0, 5)
        : [],
      subtasks: Array.isArray(body.subtasks)
        ? body.subtasks
            .filter((s) => s && typeof s.title === 'string' && s.title.trim())
            .map((s) => ({
              id: s.id || `st-${crypto.randomUUID().slice(0, 6)}`,
              title: s.title.trim().slice(0, 120),
              completed: Boolean(s.completed),
            }))
        : [],
      comments: [],
      githubIssueNumber: typeof body.githubIssueNumber === 'number' ? body.githubIssueNumber : undefined,
      githubIssueUrl: isSafeHttpUrl(body.githubIssueUrl) ? body.githubIssueUrl : undefined,
      githubRepo:
        typeof body.githubRepo === 'string' && isValidRepoSlug(body.githubRepo) ? body.githubRepo : undefined,
      createdAt: now,
      updatedAt: now,
    };

    state.tasks.push(newTask);
    const activity = recordActivity(
      authMember.name,
      'สร้างงานใหม่',
      newTask.title,
      newTask.spaceId
    );
    for (const recipientId of validAssignees) {
      pushNotification({
        recipientId,
        actor: authMember,
        type: 'task_assigned',
        task: newTask,
        message: `แท็กคุณเป็นผู้รับผิดชอบในงาน ${newTask.code}`,
      });
    }
    persistWorkspaceState(state);
    broadcast({ type: 'task:created', task: newTask, activity });
    res.status(201).json({ task: newTask });
  });

  app.patch('/api/tasks/:id', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const task = state.tasks.find((t) => t.id === req.params.id);
    if (!task) {
      res.status(404).json({ error: 'ไม่พบงานที่ต้องการแก้ไข' });
      return;
    }

    const body = req.body as Partial<TaskItem>;
    const prevStatus = task.status;
    const prevAssigneeIds = Array.isArray(task.assigneeIds)
      ? [...task.assigneeIds]
      : task.assigneeId
        ? [task.assigneeId]
        : [];
    let newlyTaggedIds: string[] = [];

    if (typeof body.title === 'string' && body.title.trim()) {
      task.title = body.title.trim().slice(0, 180);
    }
    if (typeof body.description === 'string') {
      task.description = body.description.trim().slice(0, 4000);
    }
    if (VALID_STATUSES.includes(body.status as TaskStatus)) {
      task.status = body.status as TaskStatus;
    }
    if (VALID_PRIORITIES.includes(body.priority as TaskPriority)) {
      task.priority = body.priority as TaskPriority;
    }
    if (Array.isArray(body.assigneeIds)) {
      const validIds = Array.from(
        new Set(
          body.assigneeIds.filter(
            (id): id is string =>
              typeof id === 'string' && state.members.some((m) => m.id === id)
          )
        )
      );
      newlyTaggedIds = validIds.filter((id) => !prevAssigneeIds.includes(id));
      task.assigneeIds = validIds;
      task.assigneeId = validIds[0] || '';
    } else if (typeof body.assigneeId === 'string' && state.members.some((m) => m.id === body.assigneeId)) {
      if (!prevAssigneeIds.includes(body.assigneeId)) {
        newlyTaggedIds = [body.assigneeId];
      }
      task.assigneeId = body.assigneeId;
      task.assigneeIds = [body.assigneeId];
    }
    if (typeof body.spaceId === 'string' && state.spaces.some((s) => s.id === body.spaceId)) {
      task.spaceId = body.spaceId;
    }
    if (typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
      task.dueDate = body.dueDate;
    }
    if (Array.isArray(body.tags)) {
      task.tags = body.tags
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().slice(0, 24))
        .slice(0, 5);
    }
    if (Array.isArray(body.subtasks)) {
      task.subtasks = body.subtasks
        .filter((s) => s && typeof s.title === 'string' && s.title.trim())
        .map((s) => ({
          id: s.id || `st-${crypto.randomUUID().slice(0, 6)}`,
          title: s.title.trim().slice(0, 120),
          completed: Boolean(s.completed),
        }));
    }
    if (typeof body.githubIssueNumber === 'number') {
      task.githubIssueNumber = body.githubIssueNumber;
    }
    if (isSafeHttpUrl(body.githubIssueUrl)) {
      task.githubIssueUrl = body.githubIssueUrl;
    }
    if (typeof body.githubRepo === 'string' && isValidRepoSlug(body.githubRepo)) {
      task.githubRepo = body.githubRepo;
    }

    task.updatedAt = new Date().toISOString();

    const statusLabelMap: Record<TaskStatus, string> = {
      todo: 'รอดำเนินการ',
      in_progress: 'กำลังทำ',
      review: 'รอตรวจสอบ',
      done: 'เสร็จสิ้น',
    };
    const taggedNames = newlyTaggedIds
      .map((id) => state.members.find((m) => m.id === id)?.name)
      .filter(Boolean);
    const actionText =
      prevStatus !== task.status
        ? `เปลี่ยนสถานะเป็น "${statusLabelMap[task.status]}"`
        : taggedNames.length > 0
          ? `แท็ก ${taggedNames.join(', ')} ในงาน`
          : 'อัปเดตรายละเอียดงาน';

    const activity = recordActivity(authMember.name, actionText, task.title, task.spaceId);

    for (const recipientId of newlyTaggedIds) {
      pushNotification({
        recipientId,
        actor: authMember,
        type: 'task_assigned',
        task,
        message: `แท็กคุณเป็นผู้รับผิดชอบในงาน ${task.code}`,
      });
    }

    persistWorkspaceState(state);
    broadcast({ type: 'task:updated', task, activity });
    res.json({ task });
  });

  app.post('/api/tasks/:id/move', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const task = state.tasks.find((t) => t.id === req.params.id);
    if (!task) {
      res.status(404).json({ error: 'ไม่พบงาน' });
      return;
    }
    const { status, targetIndex } = req.body as {
      status?: TaskStatus;
      targetIndex?: number;
    };

    if (!VALID_STATUSES.includes(status as TaskStatus)) {
      res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
      return;
    }

    const nextStatus = status as TaskStatus;
    const prevStatus = task.status;
    task.status = nextStatus;
    task.updatedAt = new Date().toISOString();

    // Reorder destination column cleanly
    const colTasks = state.tasks
      .filter((t) => t.status === nextStatus && t.id !== task.id)
      .sort((a, b) => a.order - b.order);

    const insertAt =
      typeof targetIndex === 'number' && targetIndex >= 0
        ? Math.min(targetIndex, colTasks.length)
        : colTasks.length;

    colTasks.splice(insertAt, 0, task);
    colTasks.forEach((t, idx) => {
      t.order = idx;
    });

    // Re-normalize old column orders if moved across columns
    if (prevStatus !== nextStatus) {
      state.tasks
        .filter((t) => t.status === prevStatus)
        .sort((a, b) => a.order - b.order)
        .forEach((t, idx) => {
          t.order = idx;
        });
    }

    const tasksOrder = state.tasks.map((t) => ({ id: t.id, status: t.status, order: t.order }));
    const statusLabelMap: Record<TaskStatus, string> = {
      todo: 'รอดำเนินการ',
      in_progress: 'กำลังทำ',
      review: 'รอตรวจสอบ',
      done: 'เสร็จสิ้น',
    };

    const activity =
      prevStatus !== nextStatus
        ? recordActivity(
            authMember.name,
            `ย้ายงานไปที่ "${statusLabelMap[nextStatus]}"`,
            task.title,
            task.spaceId
          )
        : undefined;

    persistWorkspaceState(state);
    broadcast({ type: 'task:moved', task, tasksOrder, activity });
    res.json({ task, tasksOrder });
  });

  app.delete('/api/tasks/:id', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const idx = state.tasks.findIndex((t) => t.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'ไม่พบงาน' });
      return;
    }
    const [removed] = state.tasks.splice(idx, 1);
    state.notifications = state.notifications.filter((n) => n.taskId !== removed.id);
    const activity = recordActivity(authMember.name, 'ลบงาน', removed.title, removed.spaceId);
    persistWorkspaceState(state);
    broadcast({ type: 'task:deleted', taskId: removed.id, activity });
    res.json({ deleted: true });
  });

  app.post('/api/tasks/:id/comments', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const task = state.tasks.find((t) => t.id === req.params.id);
    if (!task) {
      res.status(404).json({ error: 'ไม่พบงาน' });
      return;
    }
    const { text, mentions } = req.body as {
      text?: string;
      mentions?: string[];
    };
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'กรุณาพิมพ์ความคิดเห็น' });
      return;
    }

    const validMentions = Array.isArray(mentions)
      ? Array.from(
          new Set(
            mentions.filter(
              (id): id is string =>
                typeof id === 'string' && state.members.some((m) => m.id === id)
            )
          )
        )
      : [];

    const comment: TaskComment = {
      id: `cm-${crypto.randomUUID().slice(0, 8)}`,
      authorId: authMember.id,
      authorName: authMember.name,
      authorAvatar: authMember.avatarUrl,
      text: text.trim().slice(0, 1000),
      mentions: validMentions.length > 0 ? validMentions : undefined,
      createdAt: new Date().toISOString(),
    };
    task.comments.push(comment);
    task.updatedAt = new Date().toISOString();

    const mentionedNames = validMentions
      .map((id) => state.members.find((m) => m.id === id)?.name)
      .filter(Boolean);
    const actionLabel =
      mentionedNames.length > 0
        ? `แท็ก ${mentionedNames.join(', ')} ในงาน`
        : 'แสดงความคิดเห็นในงาน';

    const activity = recordActivity(authMember.name, actionLabel, task.title, task.spaceId);

    for (const recipientId of validMentions) {
      pushNotification({
        recipientId,
        actor: authMember,
        type: 'comment_mention',
        task,
        message: `@แท็กคุณในความคิดเห็นของงาน ${task.code}`,
      });
    }

    persistWorkspaceState(state);
    broadcast({ type: 'task:comment_added', taskId: task.id, comment, activity });
    res.status(201).json({ comment });
  });

  // --- GitHub OAuth & API Integration ---
  app.get('/api/github/config', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
    const appUrl = getAppUrl(req);
    res.json({
      oauthConfigured: Boolean(clientId && clientSecret),
      callbackUrl: `${appUrl}/auth/callback`,
    });
  });

  app.get('/api/auth/github/url', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      res.status(400).json({
        error: 'ยังไม่ได้ตั้งค่า GITHUB_CLIENT_ID และ GITHUB_CLIENT_SECRET ใน Environment Variables',
      });
      return;
    }

    const appUrl = getAppUrl(req);
    const redirectUri = `${appUrl}/auth/callback`;
    const stateToken = crypto.randomBytes(24).toString('hex');
    oauthStates.set(stateToken, Date.now() + 10 * 60_000);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo read:user',
      state: stateToken,
    });

    res.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
  });

  const handleOAuthCallback: express.RequestHandler = async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const stateToken = typeof req.query.state === 'string' ? req.query.state : '';

    const expiresAt = oauthStates.get(stateToken);
    if (!code || !stateToken || !expiresAt || Date.now() > expiresAt) {
      res.status(400).send('<p>OAuth state invalid or expired. Please close and try again.</p>');
      return;
    }
    oauthStates.delete(stateToken);

    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      res.status(500).send('<p>GitHub OAuth is not configured on the server.</p>');
      return;
    }

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });
      const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string };
      if (!tokenData.access_token) {
        res.status(400).send(`<p>GitHub token exchange failed: ${tokenData.error_description || 'Unknown error'}</p>`);
        return;
      }

      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'TaskPulse-App',
        },
      });
      if (!userRes.ok) {
        res.status(400).send('<p>Failed to fetch GitHub user profile.</p>');
        return;
      }
      const ghUser = (await userRes.json()) as GitHubUser;
      const sessionToken = crypto.randomBytes(32).toString('hex');
      githubSessions.set(sessionToken, {
        accessToken: tokenData.access_token,
        user: {
          login: ghUser.login,
          name: ghUser.name,
          avatar_url: ghUser.avatar_url,
          html_url: ghUser.html_url,
        },
      });

      const payloadJson = JSON.stringify({
        type: 'OAUTH_AUTH_SUCCESS',
        sessionToken,
        user: {
          login: ghUser.login,
          name: ghUser.name,
          avatar_url: ghUser.avatar_url,
          html_url: ghUser.html_url,
        },
      });

      res.send(`<!doctype html>
<html>
  <body>
    <script>
      (function() {
        var payload = ${payloadJson};
        if (window.opener) {
          window.opener.postMessage(payload, '*');
          window.close();
        } else {
          window.location.href = '/';
        }
      })();
    </script>
    <p>เชื่อมต่อ GitHub สำเร็จ หน้าต่างนี้จะปิดอัตโนมัติ...</p>
  </body>
</html>`);
    } catch (err) {
      console.error('OAuth callback error:', err);
      res.status(500).send('<p>OAuth error occurred.</p>');
    }
  };

  app.get(['/auth/callback', '/auth/callback/'], handleOAuthCallback);

  // Connect using a Personal Access Token (stored strictly in server memory session)
  app.post('/api/github/token', async (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== 'string' || !token.trim()) {
      res.status(400).json({ error: 'กรุณาระบุ GitHub Personal Access Token' });
      return;
    }

    try {
      const ghRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'TaskPulse-App',
        },
      });
      if (!ghRes.ok) {
        res.status(401).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบสิทธิ์อีกครั้ง' });
        return;
      }
      const ghUser = (await ghRes.json()) as GitHubUser;
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const cleanUser: GitHubUser = {
        login: ghUser.login,
        name: ghUser.name,
        avatar_url: ghUser.avatar_url,
        html_url: ghUser.html_url,
      };
      githubSessions.set(sessionToken, {
        accessToken: token.trim(),
        user: cleanUser,
      });

      res.json({ sessionToken, user: cleanUser });
    } catch {
      res.status(502).json({ error: 'ไม่สามารถติดต่อ GitHub API ได้ในขณะนี้' });
    }
  });

  app.post('/api/github/disconnect', (req, res) => {
    const ghHeader =
      typeof req.headers['x-github-session'] === 'string'
        ? req.headers['x-github-session'].trim()
        : '';
    if (ghHeader) {
      githubSessions.delete(ghHeader);
    } else {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        githubSessions.delete(auth.slice(7).trim());
      }
    }
    res.json({ disconnected: true });
  });

  app.get('/api/github/user', async (req, res) => {
    const session = getGitHubSession(req);
    if (!session) {
      res.status(401).json({ error: 'ยังไม่ได้เชื่อมต่อบัญชี GitHub' });
      return;
    }

    try {
      const reposRes = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator',
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'TaskPulse-App',
          },
        }
      );
      const repos = reposRes.ok ? ((await reposRes.json()) as GitHubRepoInfo[]) : [];
      res.json({
        user: session.user,
        repos: repos.map((r) => ({
          full_name: r.full_name,
          description: r.description,
          html_url: r.html_url,
          stargazers_count: r.stargazers_count,
          open_issues_count: r.open_issues_count,
          default_branch: r.default_branch,
          private: r.private,
          language: r.language,
          updated_at: r.updated_at,
        })),
      });
    } catch {
      res.status(502).json({ error: 'ไม่สามารถดึงรายการ Repository ได้' });
    }
  });

  // Public or authenticated repo inspection (issues + PRs)
  app.get('/api/github/repo', async (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const rawRepo = typeof req.query.repo === 'string' ? req.query.repo.trim() : '';
    const cleaned = rawRepo
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '');

    if (!isValidRepoSlug(cleaned)) {
      res.status(400).json({ error: 'รูปแบบ Repository ไม่ถูกต้อง (ตัวอย่าง: owner/repo)' });
      return;
    }

    const session = getGitHubSession(req);
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'TaskPulse-App',
    };
    if (session) {
      headers.Authorization = `Bearer ${session.accessToken}`;
    }

    try {
      const [repoRes, issuesRes, prsRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${cleaned}`, { headers }),
        fetch(`https://api.github.com/repos/${cleaned}/issues?state=open&per_page=30`, { headers }),
        fetch(`https://api.github.com/repos/${cleaned}/pulls?state=open&per_page=15`, { headers }),
      ]);

      if (!repoRes.ok) {
        if (repoRes.status === 404) {
          res.status(404).json({ error: 'ไม่พบ Repository นี้ (หากเป็น Private Repo กรุณาเชื่อมต่อบัญชี GitHub ก่อน)' });
          return;
        }
        if (repoRes.status === 403) {
          res.status(429).json({ error: 'เกินขีดจำกัด GitHub Public API กรุณาเชื่อมต่อบัญชี GitHub เพื่อเพิ่มโควตา' });
          return;
        }
        res.status(repoRes.status).json({ error: 'ไม่สามารถดึงข้อมูลจาก GitHub ได้' });
        return;
      }

      const repoInfo = (await repoRes.json()) as GitHubRepoInfo;
      const rawIssues = issuesRes.ok ? ((await issuesRes.json()) as GitHubIssue[]) : [];
      const issues = rawIssues.filter((item) => !item.pull_request);
      const pulls = prsRes.ok ? ((await prsRes.json()) as GitHubPullRequest[]) : [];

      res.json({
        repo: {
          full_name: repoInfo.full_name,
          description: repoInfo.description,
          html_url: repoInfo.html_url,
          stargazers_count: repoInfo.stargazers_count,
          open_issues_count: repoInfo.open_issues_count,
          default_branch: repoInfo.default_branch,
          private: repoInfo.private,
          language: repoInfo.language,
          updated_at: repoInfo.updated_at,
        },
        issues,
        pulls,
      });
    } catch {
      res.status(502).json({ error: 'เกิดข้อผิดพลาดขณะเชื่อมต่อ GitHub API' });
    }
  });

  // Import selected GitHub issues into a Project Space as Kanban tasks
  app.post('/api/github/import', (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const { spaceId, repo, issues } = req.body as {
      spaceId?: string;
      repo?: string;
      issues?: Array<{
        number: number;
        title: string;
        body?: string | null;
        html_url: string;
        labels?: Array<{ name: string }>;
      }>;
    };

    if (!repo || !isValidRepoSlug(repo)) {
      res.status(400).json({ error: 'Repository ไม่ถูกต้อง' });
      return;
    }

    const space = state.spaces.find((s) => s.id === spaceId) || state.spaces[0];
    if (!space) {
      res.status(400).json({ error: 'ไม่พบโปรเจกต์ปลายทาง' });
      return;
    }

    if (!Array.isArray(issues) || issues.length === 0) {
      res.status(400).json({ error: 'กรุณาเลือก Issue อย่างน้อย 1 รายการ' });
      return;
    }

    const existingCodes = state.tasks
      .filter((t) => t.spaceId === space.id)
      .map((t) => Number(t.code.split('-')[1] || 0))
      .filter((n) => !Number.isNaN(n));
    let nextNumber = (existingCodes.length > 0 ? Math.max(...existingCodes) : 0) + 1;
    let todoMaxOrder = state.tasks
      .filter((t) => t.status === 'todo')
      .reduce((acc, t) => Math.max(acc, t.order), -1);

    const importedTasks: TaskItem[] = [];
    const now = new Date().toISOString();

    for (const issue of issues.slice(0, 25)) {
      if (typeof issue.number !== 'number' || typeof issue.title !== 'string') continue;

      const duplicate = state.tasks.find(
        (t) => t.githubRepo === repo && t.githubIssueNumber === issue.number
      );
      if (duplicate) continue;

      const labelNames = Array.isArray(issue.labels)
        ? issue.labels.map((l) => l.name).filter(Boolean).slice(0, 4)
        : [];
      const priority: TaskPriority = labelNames.some((n) => /urgent|critical|p0/i.test(n))
        ? 'urgent'
        : labelNames.some((n) => /high|bug|p1/i.test(n))
          ? 'high'
          : 'normal';

      todoMaxOrder += 1;
      const newTask: TaskItem = {
        id: `task-${crypto.randomUUID().slice(0, 8)}`,
        code: `${space.key}-${nextNumber++}`,
        spaceId: space.id,
        title: issue.title.trim().slice(0, 180),
        description: typeof issue.body === 'string' ? issue.body.trim().slice(0, 4000) : '',
        status: 'todo',
        priority,
        assigneeId: authMember.id,
        assigneeIds: [authMember.id],
        dueDate: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
        order: todoMaxOrder,
        tags: ['GitHub', ...labelNames].slice(0, 5),
        subtasks: [],
        comments: [],
        githubIssueNumber: issue.number,
        githubIssueUrl: isSafeHttpUrl(issue.html_url) ? issue.html_url : undefined,
        githubRepo: repo,
        createdAt: now,
        updatedAt: now,
      };
      state.tasks.push(newTask);
      importedTasks.push(newTask);
    }

    if (importedTasks.length > 0) {
      const activity = recordActivity(
        authMember.name,
        `นำเข้า ${importedTasks.length} Issue จาก ${repo}`,
        importedTasks[0].title,
        space.id
      );
      persistWorkspaceState(state);
      for (const task of importedTasks) {
        broadcast({ type: 'task:created', task, activity });
      }
    }

    res.json({ importedCount: importedTasks.length, tasks: importedTasks });
  });

  // Create a real GitHub Issue directly from a Kanban task (requires connected GitHub session)
  app.post('/api/github/create-issue', async (req, res) => {
    const authMember = requireAuth(req, res);
    if (!authMember) return;
    const session = getGitHubSession(req);
    if (!session) {
      res.status(401).json({ error: 'กรุณาเชื่อมต่อบัญชี GitHub ก่อนสร้าง Issue' });
      return;
    }

    const { taskId, repo } = req.body as { taskId?: string; repo?: string };
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) {
      res.status(404).json({ error: 'ไม่พบงานที่ต้องการเชื่อมกับ GitHub' });
      return;
    }

    const targetRepo = (typeof repo === 'string' ? repo.trim() : '') || task.githubRepo || '';
    if (!isValidRepoSlug(targetRepo)) {
      res.status(400).json({ error: 'กรุณาระบุ Repository ปลายทางให้ถูกต้อง (owner/repo)' });
      return;
    }

    try {
      const createRes = await fetch(`https://api.github.com/repos/${targetRepo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'TaskPulse-App',
        },
        body: JSON.stringify({
          title: `[${task.code}] ${task.title}`,
          body: `${task.description || 'สร้างจาก TaskPulse Kanban'}\n\n---\n*Synced from TaskPulse (${task.code})*`,
        }),
      });

      if (!createRes.ok) {
        const errData = (await createRes.json().catch(() => ({}))) as { message?: string };
        res.status(createRes.status).json({
          error: errData.message || 'ไม่สามารถสร้าง GitHub Issue ได้ (ตรวจสอบสิทธิ์ repo)',
        });
        return;
      }

      const created = (await createRes.json()) as { number: number; html_url: string };
      task.githubIssueNumber = created.number;
      task.githubIssueUrl = created.html_url;
      task.githubRepo = targetRepo;
      task.updatedAt = new Date().toISOString();

      const activity = recordActivity(
        authMember.name,
        `สร้าง GitHub Issue #${created.number}`,
        task.title,
        task.spaceId
      );
      persistWorkspaceState(state);
      broadcast({ type: 'task:updated', task, activity });
      res.status(201).json({ task, issueNumber: created.number, issueUrl: created.html_url });
    } catch {
      res.status(502).json({ error: 'เกิดข้อผิดพลาดขณะสร้าง GitHub Issue' });
    }
  });

  // Vite middleware in development, static assets in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`TaskPulse server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
