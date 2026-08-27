import { useState } from 'react';
import { useDeck } from '../store';

export default function LoginModal() {
  const login = useDeck((s) => s.login);
  const isAuthenticated = useDeck((s) => s.isAuthenticated);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('请输入访问密码');
      return;
    }
    setLoading(true);
    setError('');
    const ok = await login(password.trim());
    setLoading(false);
    if (!ok) {
      setError('密码错误，请重试');
      navigator.vibrate?.([40, 60, 40]);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-panel p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-2xl text-accent glow-accent">
            🔒
          </div>
          <h2 className="text-lg font-bold text-text">访问控制</h2>
          <p className="text-xs text-muted mt-1">请输入访问密码进入控制台（默认: 000000）</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                autoFocus
                placeholder="请输入密码 (如: 000000)"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full rounded-xl border border-border bg-panel2 px-3.5 py-3 pr-10 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-text"
              >
                {showPwd ? '👁️' : '🔒'}
              </button>
            </div>
            {error && <p className="mt-1.5 text-xs text-red-400 font-medium">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 active:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? '正在验证...' : '进入 Termux WebUI'}
          </button>
        </form>
      </div>
    </div>
  );
}
