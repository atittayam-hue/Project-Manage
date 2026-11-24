import { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, Mail, Moon, Sun, User, UserCheck } from 'lucide-react';
import type { TeamMember } from '../types';

interface AuthScreenProps {
  ownerNeedsClaim: boolean;
  initialEmail?: string;
  initialMode?: 'login' | 'register';
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAuthenticated: (sessionToken: string, member: TeamMember) => void;
}

export function AuthScreen({
  ownerNeedsClaim,
  initialEmail = '',
  initialMode = 'login',
  darkMode,
  onToggleDarkMode,
  onAuthenticated,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      setMode('register');
    }
  }, [initialEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);

    const isRegisterFlow = ownerNeedsClaim || mode === 'register';
    if (isRegisterFlow && password !== confirmPassword) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = ownerNeedsClaim
        ? '/api/auth/claim-owner'
        : mode === 'register'
          ? '/api/auth/register'
          : '/api/auth/login';

      const payload = ownerNeedsClaim || mode === 'register'
        ? { name: name.trim(), email: email.trim(), role: role.trim(), password }
        : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as {
        sessionToken?: string;
        member?: TeamMember;
        error?: string;
        code?: string;
        memberName?: string;
        memberRole?: string;
      };

      if (!res.ok) {
        if (data.code === 'NEEDS_PASSWORD_SETUP') {
          setMode('register');
          if (data.memberName && !name) setName(data.memberName);
          if (data.memberRole && !role) setRole(data.memberRole);
          setNotice(data.error || 'กรุณาตั้งรหัสผ่านสำหรับเข้าใช้งานครั้งแรก');
          return;
        }
        setError(data.error || 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      if (data.sessionToken && data.member) {
        window.history.replaceState({}, '', window.location.pathname);
        onAuthenticated(data.sessionToken, data.member);
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setSubmitting(false);
    }
  };

  const showRegisterFields = ownerNeedsClaim || mode === 'register';

  return (
    <div className="min-h-screen w-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
            T
          </span>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            TaskPulse
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleDarkMode}
          title={darkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
          aria-label={darkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 sm:p-7 space-y-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {ownerNeedsClaim
                ? 'ตั้งค่าบัญชีผู้ดูแลพื้นที่ทำงาน'
                : mode === 'login'
                  ? 'เข้าสู่ระบบด้วยอีเมล'
                  : 'ลงทะเบียน / ตั้งรหัสผ่านด้วยอีเมล'}
            </h1>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {ownerNeedsClaim
                ? 'เริ่มต้นใช้งาน TaskPulse โดยสร้างบัญชีผู้ดูแลแรกด้วยอีเมลของคุณ จากนั้นสามารถเพิ่มอีเมลทีมงานเพื่อแท็กงานและส่งแจ้งเตือนได้ทันที'
                : mode === 'login'
                  ? 'เข้าสู่ระบบเพื่อจัดการบอร์ดคัมบัง แท็กผู้รับผิดชอบ และดูการแจ้งเตือนงานของคุณแบบเรียลไทม์'
                  : 'กรอกอีเมลและตั้งรหัสผ่านเพื่อเข้าใช้งานบอร์ดร่วมกับทีม (หากเพื่อนเพิ่มอีเมลคุณไว้แล้ว ระบบจะเชื่อมงานที่แท็กไว้ให้ทันที)'}
            </p>
          </div>

          {!ownerNeedsClaim && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setNotice(null);
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                เข้าสู่ระบบ
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setNotice(null);
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                ลงทะเบียน / ตั้งรหัสผ่าน
              </button>
            </div>
          )}

          {notice && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-xs text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
              {notice}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {showRegisterFields && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  ชื่อ-นามสกุล หรือชื่อเล่น
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น อทิตยา (Pleng)"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                อีเมล (Email)
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {showRegisterFields && (
              <div>
                <label
                  htmlFor="auth-role"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  ตำแหน่ง / หน้าที่ (ไม่บังคับ)
                </label>
                <div className="relative">
                  <UserCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-role"
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder={ownerNeedsClaim ? 'เช่น Project Owner / Team Lead' : 'เช่น Developer, Designer, QA'}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {showRegisterFields && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  ยืนยันรหัสผ่าน
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-confirm-password"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <span>
                {submitting
                  ? 'กำลังดำเนินการ...'
                  : ownerNeedsClaim
                    ? 'สร้างบัญชีผู้ดูแลและเข้าใช้งาน'
                    : mode === 'login'
                      ? 'เข้าสู่ระบบ'
                      : 'ลงทะเบียนและเข้าใช้งาน'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
