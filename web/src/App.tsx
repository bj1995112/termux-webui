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

  const active = sessions.find((s) => s.id === activeId) ?? null;

  // ?diag=1: on-device layout probe for right-edge clipping reports. Renders
  // live numbers so a phone screenshot is enough to pinpoint the culprit.
  const diag = new URLSearchParams(location.search).get('diag') === '1';
  useEffect(() => {
    if (!diag) return;
    const el = document.getElementById('diag');
    if (!el) return;
    const tick = () => {
      const host = document.querySelector('.term-host');
      const scr = (host?.querySelector('.xterm-screen') as HTMLElement | null) ?? null;
      const vp = host?.querySelector('.xterm-viewport') as HTMLElement | null;
      const row = [...(host?.querySelectorAll('.xterm-rows > div') ?? [])].find(
        (d) => d.textContent && d.textContent.trim().length > 4,
      ) as HTMLElement | undefined;
      // measure real font advances with the terminal's own font stack
      // (NOTE: .xterm-screen carries no font — the rows are the source of truth)
      let cjkW = 0;
      let cellW = 0;
      if (row) {
        const probe = document.createElement('span');
        probe.style.cssText =
          'position:absolute;visibility:hidden;white-space:pre;font-size:13px;font-family:' +
          getComputedStyle(row).fontFamily;
        probe.textContent = '中'.repeat(30);
        document.body.appendChild(probe);
        cjkW = probe.getBoundingClientRect().width / 30;
        probe.textContent = 'M'.repeat(30);
        cellW = probe.getBoundingClientRect().width / 30;
        probe.remove();
      }
      const info = [
        `dpr=${devicePixelRatio}`,
        `hostW=${host?.clientWidth ?? '?'}`,
        `screenW=${scr ? Math.round(scr.getBoundingClientRect().width * 10) / 10 : '?'}`,
        `sbGap=${vp ? vp.offsetWidth - vp.clientWidth : '?'}`,
        `rowClient=${row?.clientWidth ?? '?'}`,
        `rowScroll=${row?.scrollWidth ?? '?'}`,
        `rowOver=${row ? row.scrollWidth - row.clientWidth : '?'}`,
        `cellW=${Math.round(cellW * 100) / 100}`,
        `cjkW=${Math.round(cjkW * 100) / 100}`,
        `drift/cjk=${cellW ? Math.round((cjkW - cellW * 2) * 100) / 100 : '?'}`,
      ];
      el.textContent = info.join('  ');
    };
    const iv = window.setInterval(tick, 500);
    tick();
    return () => clearInterval(iv);
  }, [diag]);

  return (
    <div className="flex h-full flex-col">
      {diag && (
        <div
          id="diag"
          className="pointer-events-none fixed inset-x-0 top-0 z-[999] bg-black/85 px-2 py-1 font-mono text-[10px] leading-4 text-lime-300"
        />
      )}
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
