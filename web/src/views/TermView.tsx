import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { deckSocket } from '../lib/ws.js';

const DARK = {
  background: '#0b0d10',
  foreground: '#e6e9ef',
  cursor: '#4f8cff',
  selectionBackground: '#2a3f63',
};

/** sessionId → refit function, so tab activation can trigger a clean refit. */
const fitFns = new Map<string, () => void>();

interface Props {
  sessionId: string;
  active: boolean;
}

/** One xterm per session, created once and kept alive; switching tabs only
 * toggles visibility so scrollback and running programs stay intact. */
export default function TermView({ sessionId, active }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  // Create once per session.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const term = new Terminal({
      theme: DARK,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", Menlo, Consolas, monospace',
      scrollSensitivity: 3,
      fastScrollSensitivity: 8,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    term.onData((data) => deckSocket.send({ type: 'input', sessionId, data }));

    const fitNow = () => {
      try {
        fit.fit();
        if (term.cols >= 2 && term.rows >= 2) {
          deckSocket.send({ type: 'resize', sessionId, cols: term.cols, rows: term.rows });
        }
      } catch {
        /* container hidden or zero-size */
      }
    };
    fitFns.set(sessionId, fitNow);
    fitNow();

    const off = deckSocket.onMessage((msg) => {
      if (msg.type === 'output' && msg.sessionId === sessionId) term.write(msg.data);
      if (msg.type === 'exit' && msg.sessionId === sessionId) {
        term.write(`\r\n\x1b[33m[会话已退出 code=${msg.exitCode}]\x1b[0m\r\n`);
      }
    });

    const ro = new ResizeObserver(() => requestAnimationFrame(fitNow));
    ro.observe(host);
    // Attach only AFTER our message handler is registered — otherwise the
    // server's prompt/replay can arrive before anyone is listening (this is
    // why the 2nd+ session used to open blank).
    deckSocket.attach(sessionId);
    return () => {
      off();
      ro.disconnect();
      fitFns.delete(sessionId);
      term.dispose();
    };
  }, [sessionId]);

  // Hide/show on tab switch; refit when becoming visible (geometry may have
  // changed while hidden).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.style.visibility = active ? 'visible' : 'hidden';
    if (active) requestAnimationFrame(() => fitFns.get(sessionId)?.());
  }, [active, sessionId]);

  // Absolutely stacked inside <main>(relative): every session occupies the
  // full area, visibility decides who shows. In-flow stacking would push the
  // 2nd+ terminals below the clip and look "blank".
  return <div className="absolute inset-0 h-full w-full" ref={hostRef} />;
}
