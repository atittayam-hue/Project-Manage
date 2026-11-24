import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  KeyRound,
  LogOut,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react';
import { formatRelativeTime } from '../constants';
import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepoInfo,
  GitHubUser,
  ProjectSpace,
  TaskItem,
  WorkspaceState,
} from '../types';
import { downloadTextFile, exportWorkspaceJson, generateGitHubMarkdown } from '../utils/exportWorkspace';

interface GitHubIntegrationViewProps {
  workspaceState: WorkspaceState;
  spaces: ProjectSpace[];
  tasks: TaskItem[];
  activeSpaceId: string | 'all';
  activeActorName: string;
  githubSessionToken: string | null;
  githubUser: GitHubUser | null;
  onGitHubConnected: (sessionToken: string, user: GitHubUser) => void;
  onGitHubDisconnected: () => void;
  onTasksImported: () => void;
}

export function GitHubIntegrationView({
  workspaceState,
  spaces,
  tasks,
  activeSpaceId,
  activeActorName,
  githubSessionToken,
  githubUser,
  onGitHubConnected,
  onGitHubDisconnected,
  onTasksImported,
}: GitHubIntegrationViewProps) {
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [patInput, setPatInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [userRepos, setUserRepos] = useState<GitHubRepoInfo[]>([]);
  const [repoQuery, setRepoQuery] = useState('facebook/react');
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [pulls, setPulls] = useState<GitHubPullRequest[]>([]);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  const [selectedIssues, setSelectedIssues] = useState<number[]>([]);
  const [targetSpaceId, setTargetSpaceId] = useState<string>(
    activeSpaceId !== 'all' ? activeSpaceId : spaces[0]?.id || ''
  );
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);

  useEffect(() => {
    if (activeSpaceId !== 'all') {
      setTargetSpaceId(activeSpaceId);
    } else if (!targetSpaceId && spaces[0]) {
      setTargetSpaceId(spaces[0].id);
    }
  }, [activeSpaceId, spaces, targetSpaceId]);

  useEffect(() => {
    fetch('/api/github/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { oauthConfigured?: boolean; callbackUrl?: string } | null) => {
        if (data) {
          setOauthConfigured(Boolean(data.oauthConfigured));
          setCallbackUrl(data.callbackUrl || `${window.location.origin}/auth/callback`);
        }
      })
      .catch(() => {
        setCallbackUrl(`${window.location.origin}/auth/callback`);
      });
  }, []);

  // Listen for OAuth popup success message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }
      const data = event.data as {
        type?: string;
        sessionToken?: string;
        user?: GitHubUser;
      } | null;
      if (data?.type === 'OAUTH_AUTH_SUCCESS' && data.sessionToken && data.user) {
        onGitHubConnected(data.sessionToken, data.user);
        setAuthError(null);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onGitHubConnected]);

  // Fetch user's repos when connected
  useEffect(() => {
    if (!githubSessionToken) {
      setUserRepos([]);
      return;
    }
    fetch('/api/github/user', {
      headers: { Authorization: `Bearer ${githubSessionToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { repos?: GitHubRepoInfo[] } | null) => {
        if (data?.repos) {
          setUserRepos(data.repos);
          if (data.repos[0]) {
            setRepoQuery(data.repos[0].full_name);
          }
        }
      })
      .catch(() => {
        // Ignore silent repo fetch failure
      });
  }, [githubSessionToken]);

  const fetchRepo = useCallback(
    async (slug: string) => {
      const trimmed = slug.trim();
      if (!trimmed) return;
      setRepoLoading(true);
      setRepoError(null);
      setImportNotice(null);
      setSelectedIssues([]);
      try {
        const headers: Record<string, string> = {};
        if (githubSessionToken) {
          headers.Authorization = `Bearer ${githubSessionToken}`;
        }
        const res = await fetch(`/api/github/repo?repo=${encodeURIComponent(trimmed)}`, {
          headers,
        });
        const data = (await res.json()) as {
          repo?: GitHubRepoInfo;
          issues?: GitHubIssue[];
          pulls?: GitHubPullRequest[];
          error?: string;
        };
        if (!res.ok || !data.repo) {
          setRepoError(data.error || 'ไม่สามารถโหลดข้อมูล Repository ได้');
          setRepoInfo(null);
          setIssues([]);
          setPulls([]);
          return;
        }
        setRepoInfo(data.repo);
        setIssues(data.issues || []);
        setPulls(data.pulls || []);
      } catch {
        setRepoError('เกิดข้อผิดพลาดในการเชื่อมต่อ GitHub');
      } finally {
        setRepoLoading(false);
      }
    },
    [githubSessionToken]
  );

  useEffect(() => {
    void fetchRepo('facebook/react');
  }, [fetchRepo]);

  const handleOAuthLogin = async () => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/github/url');
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setAuthError(data.error || 'ไม่สามารถเปิดหน้าต่างเข้าสู่ระบบ GitHub ได้');
        return;
      }
      const popup = window.open(data.url, 'github_oauth_popup', 'width=620,height=720');
      if (!popup) {
        setAuthError('เบราว์เซอร์บล็อกหน้าต่าง Popup กรุณาอนุญาต Popup สำหรับเว็บไซต์นี้');
      }
    } catch {
      setAuthError('เกิดข้อผิดพลาดขณะเริ่มการเชื่อมต่อ OAuth');
    }
  };

  const handlePatConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = patInput.trim();
    if (!token || authLoading) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/github/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as {
        sessionToken?: string;
        user?: GitHubUser;
        error?: string;
      };
      if (!res.ok || !data.sessionToken || !data.user) {
        setAuthError(data.error || 'Token ไม่ถูกต้อง');
        return;
      }
      setPatInput('');
      onGitHubConnected(data.sessionToken, data.user);
    } catch {
      setAuthError('ไม่สามารถตรวจสอบ Token กับ GitHub ได้');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (githubSessionToken) {
      await fetch('/api/github/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${githubSessionToken}` },
      }).catch(() => undefined);
    }
    onGitHubDisconnected();
  };

  const handleToggleIssue = (issueNumber: number) => {
    setSelectedIssues((prev) =>
      prev.includes(issueNumber) ? prev.filter((n) => n !== issueNumber) : [...prev, issueNumber]
    );
  };

  const handleImportIssues = async () => {
    if (!repoInfo || selectedIssues.length === 0 || importing) return;
    setImporting(true);
    setImportNotice(null);
    try {
      const chosen = issues.filter((i) => selectedIssues.includes(i.number));
      const res = await fetch('/api/github/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceId: targetSpaceId || spaces[0]?.id,
          repo: repoInfo.full_name,
          issues: chosen,
          actorName: activeActorName,
        }),
      });
      const data = (await res.json()) as { importedCount?: number; error?: string };
      if (!res.ok) {
        setImportNotice(data.error || 'นำเข้าไม่สำเร็จ');
        return;
      }
      setImportNotice(`นำเข้า ${data.importedCount || 0} Issue เข้าบอร์ดคัมบังเรียบร้อยแล้ว`);
      setSelectedIssues([]);
      onTasksImported();
    } finally {
      setImporting(false);
    }
  };

  const markdownPreview = generateGitHubMarkdown(workspaceState, activeSpaceId);

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6 space-y-6 kanban-scroll">
      {/* Top Row: Account Connection + Markdown Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* GitHub Account Connection */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                เชื่อมต่อบัญชี GitHub
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                ดึง Repository สาธารณะได้ฟรีทันที หรือเชื่อมต่อบัญชีเพื่อเข้าถึง Private Repo และสร้าง Issue จากบอร์ด
              </p>
            </div>
            <GitBranch className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>

          {githubUser ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={githubUser.avatar_url}
                    alt={`GitHub avatar ของ ${githubUser.login}`}
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-full border border-slate-200 dark:border-slate-700"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {githubUser.name || githubUser.login}
                    </p>
                    <a
                      href={githubUser.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      @{githubUser.login}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  ออกจากระบบ
                </button>
              </div>

              {userRepos.length > 0 && (
                <div className="mt-4 pt-3 border-t border-emerald-200/70 dark:border-emerald-900/50">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Repository ของคุณ ({userRepos.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto kanban-scroll">
                    {userRepos.map((r) => (
                      <button
                        key={r.full_name}
                        type="button"
                        onClick={() => {
                          setRepoQuery(r.full_name);
                          void fetchRepo(r.full_name);
                        }}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {r.full_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {oauthConfigured && (
                <button
                  type="button"
                  onClick={() => void handleOAuthLogin()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700"
                >
                  <GitBranch className="h-4 w-4" />
                  เชื่อมต่อด้วย GitHub OAuth
                </button>
              )}

              <form onSubmit={handlePatConnect} className="space-y-2">
                <label
                  htmlFor="github-pat-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  เชื่อมต่อด่วนด้วย GitHub Personal Access Token (เก็บเฉพาะในหน่วยความจำชั่วคราว)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="github-pat-input"
                      type="password"
                      value={patInput}
                      onChange={(e) => setPatInput(e.target.value)}
                      placeholder="ghp_... หรือ github_pat_..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!patInput.trim() || authLoading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {authLoading ? 'กำลังตรวจสอบ...' : 'เชื่อมต่อ'}
                  </button>
                </div>
              </form>

              {authError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{authError}</p>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  ต้องการใช้ GitHub OAuth App ของตัวเอง?
                </p>
                <p>
                  ตั้งค่า Callback URL ใน GitHub Developer Settings เป็น:
                </p>
                <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-900">
                  <span className="truncate">{callbackUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(callbackUrl);
                      setCopiedCallback(true);
                      window.setTimeout(() => setCopiedCallback(false), 1800);
                    }}
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 shrink-0"
                  >
                    {copiedCallback ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedCallback ? 'คัดลอกแล้ว' : 'คัดลอก'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* GitHub TASKS.md & JSON Export */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                ส่งออกสรุปงานสำหรับ GitHub Repository (TASKS.md)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                สร้างไฟล์ Markdown มาตรฐาน GitHub พร้อม Checkbox และลิงก์ Issue สำหรับ Commit ขึ้น Repo ทันที
              </p>
            </div>
          </div>

          <pre className="h-44 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 kanban-scroll">
            {markdownPreview}
          </pre>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(markdownPreview);
                setCopiedMd(true);
                window.setTimeout(() => setCopiedMd(false), 1800);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {copiedMd ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedMd ? 'คัดลอก Markdown แล้ว' : 'คัดลอก Markdown'}</span>
            </button>

            <button
              type="button"
              onClick={() => downloadTextFile('TASKS.md', markdownPreview, 'text/markdown;charset=utf-8')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Download className="h-3.5 w-3.5" />
              <span>ดาวน์โหลด TASKS.md</span>
            </button>

            <button
              type="button"
              onClick={() =>
                exportWorkspaceJson(
                  workspaceState,
                  activeSpaceId !== 'all'
                    ? spaces.find((s) => s.id === activeSpaceId)
                    : undefined
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </section>
      </div>

      {/* Repo Inspector & Issue Importer */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              ดึง Issues และ Pull Requests จาก GitHub Repository
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ระบุชื่อ Repository เช่น <span className="font-mono">facebook/react</span> หรือวาง URL ของ GitHub
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void fetchRepo(repoQuery);
            }}
            className="flex items-center gap-2 w-full md:w-auto"
          >
            <div className="relative flex-1 md:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={repoQuery}
                onChange={(e) => setRepoQuery(e.target.value)}
                placeholder="owner/repo หรือ https://github.com/..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={repoLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${repoLoading ? 'animate-spin' : ''}`} />
              <span>ดึงข้อมูล</span>
            </button>
          </form>
        </div>

        {/* Quick Repo Examples */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">ตัวอย่างด่วน:</span>
          {['facebook/react', 'vitejs/vite', 'tailwindlabs/tailwindcss'].map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => {
                setRepoQuery(sample);
                void fetchRepo(sample);
              }}
              className="font-mono text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {sample}
            </button>
          ))}
        </div>

        {repoError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
            {repoError}
          </div>
        )}

        {repoInfo && (
          <div className="space-y-5">
            {/* Repo Summary Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={repoInfo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                  >
                    {repoInfo.full_name}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {repoInfo.private ? 'Private' : 'Public'}
                  </span>
                  {repoInfo.language && (
                    <>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {repoInfo.language}
                      </span>
                    </>
                  )}
                </div>
                {repoInfo.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {repoInfo.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-5 shrink-0 font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  {repoInfo.stargazers_count.toLocaleString()}
                </span>
                <span>{issues.length} Issues</span>
                <span>{pulls.length} PRs</span>
                <span className="text-slate-400">branch: {repoInfo.default_branch}</span>
              </div>
            </div>

            {/* Import Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span>เลือก Issue เพื่อนำเข้าเป็นงานบนบอร์ดคัมบัง:</span>
                <select
                  aria-label="โปรเจกต์ปลายทาง"
                  value={targetSpaceId}
                  onChange={(e) => setTargetSpaceId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      โปรเจกต์: {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                {importNotice && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {importNotice}
                  </span>
                )}
                <button
                  type="button"
                  disabled={selectedIssues.length === 0 || importing}
                  onClick={() => void handleImportIssues()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {importing
                    ? 'กำลังนำเข้า...'
                    : `นำเข้า ${selectedIssues.length} รายการลงบอร์ด`}
                </button>
              </div>
            </div>

            {/* Issues & PRs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Open Issues */}
              <div className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-200">
                  Open Issues ({issues.length})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto kanban-scroll">
                  {issues.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-400">
                      ไม่พบ Open Issue ใน Repository นี้
                    </p>
                  ) : (
                    issues.map((issue) => {
                      const alreadyImported = tasks.some(
                        (t) =>
                          t.githubRepo === repoInfo.full_name &&
                          t.githubIssueNumber === issue.number
                      );
                      const checked = selectedIssues.includes(issue.number);
                      return (
                        <label
                          key={issue.id}
                          className={`flex items-start gap-3 px-4 py-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                            alreadyImported ? 'opacity-60' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={alreadyImported}
                            checked={checked || alreadyImported}
                            onChange={() => handleToggleIssue(issue.number)}
                            className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-slate-500 dark:text-slate-400">
                                #{issue.number} · @{issue.user.login}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400">
                                {formatRelativeTime(issue.updated_at)}
                              </span>
                            </div>
                            <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100 leading-snug">
                              {issue.title}
                            </p>
                            {alreadyImported ? (
                              <span className="mt-1 inline-block text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                นำเข้าในบอร์ดแล้ว
                              </span>
                            ) : (
                              issue.labels.length > 0 && (
                                <p className="mt-1 text-[11px] text-slate-400">
                                  {issue.labels.map((l) => l.name).join(' · ')}
                                </p>
                              )
                            )}
                          </div>
                          <a
                            href={issue.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`เปิด Issue #${issue.number} บน GitHub`}
                            className="text-slate-400 hover:text-indigo-600 p-1"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Open Pull Requests */}
              <div className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-200">
                  Open Pull Requests ({pulls.length})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto kanban-scroll">
                  {pulls.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-400">
                      ไม่มี Pull Request ที่เปิดอยู่
                    </p>
                  ) : (
                    pulls.map((pr) => (
                      <a
                        key={pr.id}
                        href={pr.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                            <GitPullRequest className="h-3.5 w-3.5" />
                            #{pr.number}
                          </span>
                          <span>@{pr.user.login}</span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                          {pr.title}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400 truncate">
                          {pr.head.ref} → {pr.base.ref}
                        </p>
                      </a>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
