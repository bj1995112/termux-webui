import { useEffect, useState } from 'react';
import type { ProjectInfo } from '@termux-webui/shared';
import { useDeck } from '../store';

function parseArgs(str: string): string[] | undefined {
  const trimmed = str.trim();
  if (!trimmed) return undefined;
  const matches = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
  if (!matches) return undefined;
  return matches.map((m) => m.replace(/^['"](.*)['"]$/, '$1'));
}

function parseEnv(str: string): Record<string, string> | undefined {
  const trimmed = str.trim();
  if (!trimmed) return undefined;
  const result: Record<string, string> = {};
  const lines = trimmed.split(/[\n,;]+/);
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k) result[k] = v;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export default function NewSessionDialog({ onClose }: { onClose: () => void }) {
  const clis = useDeck((s) => s.clis);
  const createSession = useDeck((s) => s.createSession);
  const token = useDeck((s) => s.token);
  const [cwd, setCwd] = useState('');
  const [argsStr, setArgsStr] = useState('');
  const [envStr, setEnvStr] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [busy, setBusy] = useState(false);

  const available = clis.filter((c) => c.available);

  useEffect(() => {
    fetch('/api/projects', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [token]);

  const launch = async (kind: (typeof clis)[number]['id']) => {
    setBusy(true);
    try {
      const args = parseArgs(argsStr);
      const env = parseEnv(envStr);
      await createSession(kind, cwd || undefined, args, env);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl border border-border border-b-0 bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-6 duration-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-text">⊕ 新建会话</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-text"
          >
            ✕
          </button>
        </div>

        {projects.length > 0 && (
          <>
            <p className="mb-1.5 text-xs font-semibold text-muted">选择项目目录</p>
            <div className="mb-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {projects.map((p) => (
                <button
                  key={p.path}
                  onClick={() => setCwd(p.path)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
                    cwd === p.path
                      ? 'border-accent bg-accent/20 text-accent font-semibold shadow-sm'
                      : 'border-border bg-panel2 text-muted hover:text-text'
                  }`}
                >
                  📁 {p.name}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="mb-3 block text-xs">
          <span className="mb-1 block font-semibold text-muted">或手动输入工作目录 (默认 ~)</span>
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="~/projects/myapp"
            className="w-full rounded-xl border border-border bg-panel2 px-3 py-2 text-xs text-text outline-none focus:border-accent"
          />
        </label>

        {/* 高级选项折叠 */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-text"
          >
            <span>{showAdvanced ? '▾' : '▸'}</span>
            <span>高级选项（启动参数 / 环境变量）</span>
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-2.5 rounded-xl border border-border bg-panel2/60 p-3">
              <label className="block text-xs">
                <span className="mb-1 block text-muted">启动参数 (CLI Args)</span>
                <input
                  value={argsStr}
                  onChange={(e) => setArgsStr(e.target.value)}
                  placeholder="例如: --resume 或 --model sonnet"
                  className="w-full rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent text-text"
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-muted">环境变量 (Environment Variables)</span>
                <input
                  value={envStr}
                  onChange={(e) => setEnvStr(e.target.value)}
                  placeholder="例如: DEBUG=1, HTTPS_PROXY=http://127.0.0.1:7890"
                  className="w-full rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent text-text"
                />
              </label>
            </div>
          )}
        </div>

        <p className="mb-2 text-xs font-semibold text-muted">选择要启动的 AI Agent / Shell</p>
        <div className="grid grid-cols-3 gap-2">
          {available.map((cli) => (
            <button
              key={cli.id}
              disabled={busy}
              onClick={() => void launch(cli.id)}
              className="flex flex-col items-center justify-center rounded-xl border border-border bg-panel2 px-2 py-3 text-xs font-semibold text-text hover:border-accent hover:text-accent active:scale-95 transition-all shadow-sm"
              title={cli.path}
            >
              <span>{cli.label}</span>
            </button>
          ))}
        </div>
        {available.length === 0 && (
          <p className="py-3 text-center text-xs text-muted">未检测到可用的 CLI</p>
        )}
      </section>
    </div>
  );
}
