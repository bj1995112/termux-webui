import { useEffect, useState } from 'react';
import { deckSocket } from './lib/ws.js';
import { useDeck } from './store.js';
import TermView from './views/TermView';
import QuickKeyboard from './components/QuickKeyboard';
import SessionTabs from './components/SessionTabs';
import NewSessionDialog from './components/NewSessionDialog';

export default function App() {
  const sessions = useDeck((s) => s.sessions);
  const activeId = useDeck((s) => s.activeId);
  const setActive = useDeck((s) => s.setActive);
  const loadSessions = useDeck((s) => s.loadSessions);
  const loadClis = useDeck((s) => s.loadClis);
  const keyboardVisible = useDeck((s) => s.keyboardVisible);
  const toggleKeyboard = useDeck((s) => s.toggleKeyboard);
  const [showNew, setShowNew] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  useEffect(() => deckSocket.onStatus(setWsStatus), []);

  useEffect(() => {
    deckSocket.connect();
    void loadClis();
    void loadSessions();
    return () => deckSocket.close();
  }, [loadClis, loadSessions]);

  // Auto-attach every session so background output keeps flowing into the
  // hidden terminals (scrollback stays complete).
  useEffect(() => {
    for (const s of sessions) deckSocket.attach(s.id);
  }, [sessions]);

  const active = sessions.find((s) => s.id === activeId) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-2 border-b border-border bg-panel px-3 py-2">
        <span
          title={wsStatus === 'online' ? '已连接' : wsStatus === 'connecting' ? '连接中…' : '连接断开,重试中'}
          className={`h-2 w-2 flex-shrink-0 rounded-full ${
            wsStatus === 'online' ? 'bg-emerald-400' : wsStatus === 'connecting' ? 'animate-pulse bg-amber-400' : 'bg-red-500'
          }`}
        />
        <span className="text-sm font-bold tracking-wide text-accent">▚ Termux WebUI</span>
        {active && <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">{active.kind}</span>}
        <button
          onClick={() => setShowNew(true)}
          className="ml-auto rounded-lg border border-border bg-panel2 px-2.5 py-1 text-sm active:border-accent"
        >
          ⊕ 新建
        </button>
        {active && keyboardVisible === false && (
          <button onClick={() => toggleKeyboard(true)} className="rounded-lg border border-border px-2 py-1 text-xs text-muted active:text-text">
            ⌨︎
          </button>
        )}
      </header>

      {/* Content: all terminals mounted, only the active one visible */}
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

      {/* Keyboard + tabs */}
      {keyboardVisible && active && <QuickKeyboard sessionId={active.id} onHide={() => toggleKeyboard(false)} />}
      <SessionTabs />

      {showNew && <NewSessionDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}
