import { useEffect, useState } from 'react';
import type { ProjectInfo } from '@termux-webui/shared';
import { useDeck } from '../store';

export default function NewSessionDialog({ onClose }: { onClose: () => void }) {
  const clis = useDeck((s) => s.clis);
  const createSession = useDeck((s) => s.createSession);
  const [cwd, setCwd] = useState('');
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
      await createSession(kind, cwd || undefined);
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
      <section className="w-full max-w-md rounded-t-2xl border border-border border-b-0 bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <h2 className="mb-3 text-base font-semibold">新建会话</h2>

        {projects.length > 0 && (
          <>
            <p className="mb-1.5 text-xs text-muted">选择项目</p>
            <div className="mb-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
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
            className="w-full rounded-lg border border-border bg-panel2 px-3 py-2 outline-none focus:border-accent"
          />
        </label>

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
