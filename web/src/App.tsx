import { useEffect, useState } from 'react';
import { deckSocket } from './lib/ws.js';
import { useDeck } from './store.js';
import TermView from './views/TermView';
import QuickKeyboard from './components/QuickKeyboard';
import NewSessionDialog from './components/NewSessionDialog';
import Drawer from './components/Drawer';

export default function App() {
  const sessions = useDeck((s) => s.sessions);
  const activeId = useDeck((s) => s.activeId);
  const loadSessions = useDeck((s) => s.loadSessions);
  const loadClis = useDeck((s) => s.loadClis);
  const keyboardVisible = useDeck((s) => s.keyboardVisible);
  const toggleKeyboard = useDeck((s) => s.toggleKeyboard);
  const [showNew, setShowNew] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  useEffect(() => deckSocket.onStatus(setWsStatus), []);

  useEffect(() => {
    deckSocket.connect();
    void loadClis();
    void loadSessions();
    return () => deckSocket.close();
  }, [loadClis, loadSessions]);

  const active = sessions.find((s) => s.id === activeId) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-1.5 border-b border-border bg-panel px-2.5 py-2">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-base leading-none text-muted active:text-text"
          title="会话列表与菜单"
        >
          <span>☰</span>
          {sessions.length > 1 && (
            <span className="rounded-full bg-accent/20 px-1.5 text-[10px] font-bold text-accent">
              {sessions.length}
            </span>
          )}
        </button>
        <span
          title={wsStatus === 'online' ? '已连接' : wsStatus === 'connecting' ? '连接中…' : '连接断开,重试中'}
          className={`h-2 w-2 flex-shrink-0 rounded-full ${
            wsStatus === 'online' ? 'bg-emerald-400' : wsStatus === 'connecting' ? 'animate-pulse bg-amber-400' : 'bg-red-500'
          }`}
        />
        <span className="text-sm font-bold tracking-wide text-accent">▚ Termux WebUI</span>
        {active && (
          <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted font-mono">
            {active.kind}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg border border-border bg-panel2 px-2.5 py-1 text-sm active:border-accent"
          >
            ⊕ 新建
          </button>

          {active && keyboardVisible === false && (
            <button
              onClick={() => toggleKeyboard(true)}
              className="rounded-lg border border-border px-2 py-1 text-xs text-muted active:text-text"
              title="显示快捷键盘"
            >
              ⌨︎
            </button>
          )}
        </div>
      </header>

      {/* Content: Maximized Expansive Terminal Viewport */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
            <p className="text-sm">还没有会话</p>
            <button
              onClick={() => setShowNew(true)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              ⊕ 新建会话
            </button>
          </div>
        ) : (
          sessions.map((s) => <TermView key={s.id} sessionId={s.id} active={s.id === activeId} />)
        )}
      </main>

      {/* Keyboard (cleanly docked right at bottom, zero vertical waste) */}
      {keyboardVisible && active && <QuickKeyboard sessionId={active.id} onHide={() => toggleKeyboard(false)} />}

      {showNew && <NewSessionDialog onClose={() => setShowNew(false)} />}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNewSession={() => setShowNew(true)}
      />
    </div>
  );
}
