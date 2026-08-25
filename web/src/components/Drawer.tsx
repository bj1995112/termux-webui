import { useState } from 'react';
import { useDeck } from '../store.js';

export default function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState<'main' | 'settings'>('main');
  const rightReservePct = useDeck((s) => s.rightReservePct);
  const setRightReservePct = useDeck((s) => s.setRightReservePct);

  const close = () => {
    onClose();
    window.setTimeout(() => setPage('main'), 250); // reset after the slide-out
  };

  return (
    <div className={`fixed inset-0 z-[80] ${open ? '' : 'pointer-events-none'}`}>
      {/* scrim */}
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* panel */}
      <aside
        className={`absolute inset-y-0 left-0 flex w-[78%] max-w-[320px] flex-col border-r border-border bg-panel shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {page === 'main' ? (
          <>
            <div className="border-b border-border px-4 pb-3 pt-5">
              <p className="text-base font-bold text-accent">▚ Termux WebUI</p>
              <p className="mt-0.5 text-xs text-muted">手机终端 · 多会话</p>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {/* future entries go here */}
            </nav>
            <button
              onClick={() => setPage('settings')}
              className="flex items-center gap-3 border-t border-border px-4 py-4 text-left text-sm active:bg-panel2"
            >
              <span className="text-lg leading-none">⚙️</span>
              <span>设置</span>
              <span className="ml-auto text-muted">›</span>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-3 py-3">
              <button onClick={() => setPage('main')} className="rounded-lg px-2 py-1 text-sm text-muted active:text-text">
                ‹ 返回
              </button>
              <p className="text-sm font-bold">设置</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="text-sm font-medium">终端右侧预留宽度</p>
              <p className="mt-1 text-xs leading-4 text-muted">
                在右侧留出空白,避免长行末尾的字符被裁掉。0% 完全铺满。
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="w-8 text-xs text-muted">0%</span>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={rightReservePct}
                  onChange={(e) => setRightReservePct(Number(e.target.value))}
                  className="h-6 flex-1 accent-[var(--color-accent)]"
                />
                <span className="w-9 text-right text-xs text-muted">20%</span>
              </div>
              <p className="mt-2 text-center text-sm text-accent">当前:{rightReservePct}%</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
