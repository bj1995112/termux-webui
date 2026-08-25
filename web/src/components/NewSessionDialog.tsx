import { useState } from 'react';
import { useDeck } from '../store';

export default function NewSessionDialog({ onClose }: { onClose: () => void }) {
  const clis = useDeck((s) => s.clis);
  const createSession = useDeck((s) => s.createSession);
  const [cwd, setCwd] = useState('');
  const [busy, setBusy] = useState(false);

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
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">项目目录(默认 ~)</span>
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="~/projects/myapp"
            className="w-full rounded-lg border border-border bg-panel2 px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          {clis.map((cli) => (
            <button
              key={cli.id}
              disabled={!cli.available || busy}
              onClick={() => void launch(cli.id)}
              className={`rounded-lg border px-2 py-3 text-sm ${
                cli.available
                  ? 'border-border bg-panel2 active:border-accent active:text-accent'
                  : 'cursor-not-allowed border-border/40 text-muted/40 line-through'
              }`}
              title={cli.path ?? '未安装'}
            >
              {cli.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
