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
  const [cwd, setCwd] = useState('');
  const [argsStr, setArgsStr] = useState('');
  const [envStr, setEnvStr] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [busy, setBusy] = useState(false);

  const available = clis.filter((c) => c.available);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl border border-border border-b-0 bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <h2 className="mb-3 text-base font-semibold">新建会话</h2>

        {projects.length > 0 && (
          <>
            <p className="mb-1.5 text-xs text-muted">选择项目</p>
            <div className="mb-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {projects.map((p) => (
                <button
                  key={p.path}
                  onClick={() => setCwd(p.path)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                    cwd === p.path ? 'border-accent bg-accent/15 text-text' : 'border-border bg-panel2 text-muted'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">或手动输入目录(默认 ~)</span>
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="~/projects/myapp"
            className="w-full rounded-lg border border-border bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
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
            <div className="mt-2 space-y-2.5 rounded-lg border border-border bg-panel2/60 p-2.5">
              <label className="block text-xs">
                <span className="mb-1 block text-muted">启动参数 (CLI Args)</span>
                <input
                  value={argsStr}
                  onChange={(e) => setArgsStr(e.target.value)}
                  placeholder="例如: --resume 或 --model sonnet"
                  className="w-full rounded border border-border bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-muted">环境变量 (Environment Variables, 键值对)</span>
                <input
                  value={envStr}
                  onChange={(e) => setEnvStr(e.target.value)}
                  placeholder="例如: DEBUG=1, HTTPS_PROXY=http://127.0.0.1:7890"
                  className="w-full rounded border border-border bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
            </div>
          )}
        </div>

        <div className={`gap-2 ${available.length <= 3 ? 'grid grid-cols-3' : 'grid grid-cols-3'}`}>
          {available.map((cli) => (
            <button
              key={cli.id}
              disabled={busy}
              onClick={() => void launch(cli.id)}
              className="rounded-lg border border-border bg-panel2 px-2 py-3 text-sm active:border-accent active:text-accent"
              title={cli.path}
            >
              {cli.label}
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

