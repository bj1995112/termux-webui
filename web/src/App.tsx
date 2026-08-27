import { useEffect, useState } from 'react';
import { deckSocket } from './lib/ws.js';
import { useDeck } from './store.js';
import TermView from './views/TermView';
import QuickKeyboard from './components/QuickKeyboard';
import NewSessionDialog from './components/NewSessionDialog';
import Drawer from './components/Drawer';
import Toast from './components/Toast';
import LoginModal from './components/LoginModal';
import ConversationPreviewModal from './components/ConversationPreviewModal';

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const sessions = useDeck((s) => s.sessions);
  const activeId = useDeck((s) => s.activeId);
  const loadSessions = useDeck((s) => s.loadSessions);
  const loadClis = useDeck((s) => s.loadClis);
  const checkAuth = useDeck((s) => s.checkAuth);
  const isAuthenticated = useDeck((s) => s.isAuthenticated);
  const keyboardVisible = useDeck((s) => s.keyboardVisible);
  const toggleKeyboard = useDeck((s) => s.toggleKeyboard);
  const [showNew, setShowNew] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  useEffect(() => deckSocket.onStatus(setWsStatus), []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      deckSocket.connect();
      void loadClis();
      void loadSessions();
    }
  }, [isAuthenticated, loadClis, loadSessions]);

  const active = sessions.find((s) => s.id === activeId) ?? null;

  return (
    <div className="flex h-full flex-col bg-panel text-text selection:bg-accent/30 selection:text-white">
      {/* Top Header Bar */}
      <header className="flex items-center gap-2 border-b border-border bg-panel/90 px-3 py-2.5 backdrop-blur-md z-30">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1 rounded-xl bg-panel2/80 px-2 py-1.5 text-sm text-text hover:bg-panel2 active:scale-95 transition-all shadow-sm"
          title="会话列表与菜单"
        >
          <span>☰</span>
          {sessions.length > 1 && (
            <span className="rounded-full bg-accent/20 px-1.5 text-[10px] font-bold text-accent">
              {sessions.length}
            </span>
          )}
        </button>

        {/* WS Online Status Dot */}
        <span
          title={wsStatus === 'online' ? '实时双向流: 在线' : wsStatus === 'connecting' ? '正在握手连接…' : '连接断开, 重连中'}
          className={`h-2.5 w-2.5 flex-shrink-0 rounded-full transition-colors ${
            wsStatus === 'online'
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
              : wsStatus === 'connecting'
              ? 'animate-pulse bg-amber-400'
              : 'bg-red-500'
          }`}
        />

        {/* App Title */}
        <span className="text-sm font-bold tracking-wide text-accent">▚ Termux WebUI</span>

        {/* Active Session Label */}
        {active && (
          <span className="rounded-lg bg-panel2 px-2 py-0.5 text-[10px] font-mono text-muted border border-border/40">
            {active.kind}
          </span>
        )}

        {/* Right Actions */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1 rounded-xl bg-accent px-3 py-1 text-xs font-semibold text-white shadow-md active:bg-accent-hover active:scale-95 transition-all"
          >
            <span>⊕</span>
            <span>新建</span>
          </button>

          {active && keyboardVisible === false && (
            <button
              onClick={() => toggleKeyboard(true)}
              className="rounded-xl border border-border bg-panel2 px-2.5 py-1 text-xs text-muted hover:text-text active:scale-95 transition-all"
              title="展开快捷辅助键盘"
            >
              ⌨︎
            </button>
          )}
        </div>
      </header>

      {/* Content: Maximized Expansive Terminal Viewport */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <ErrorBoundary>
          {sessions.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3.5 text-muted p-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-panel2 text-3xl text-accent glow-accent">
                ⚡
              </div>
              <div>
                <p className="text-sm font-bold text-text">还没有打开的终端</p>
                <p className="text-xs text-muted mt-1">选择一个 AI Agent 或原生 Shell 开始编程</p>
              </div>
              <button
                onClick={() => setShowNew(true)}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-lg active:bg-accent-hover active:scale-95 transition-all"
              >
                ⊕ 新建终端会话
              </button>
            </div>
          ) : (
            sessions.map((s) => <TermView key={s.id} sessionId={s.id} active={s.id === activeId} />)
          )}
        </ErrorBoundary>
      </main>

      {/* Keyboard (cleanly docked right at bottom, zero vertical waste) */}
      {keyboardVisible && active && <QuickKeyboard sessionId={active.id} onHide={() => toggleKeyboard(false)} />}

      {showNew && <NewSessionDialog onClose={() => setShowNew(false)} />}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNewSession={() => setShowNew(true)}
      />

      <ConversationPreviewModal />
      <LoginModal />
      <Toast />
    </div>
  );
}
