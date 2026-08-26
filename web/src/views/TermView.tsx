import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { deckSocket } from '../lib/ws.js';
import { useDeck } from '../store.js';

const DARK = {
  background: '#0b0d10',
  foreground: '#e6e9ef',
  cursor: '#4f8cff',
  selectionBackground: '#2a3f6399',
};

/** sessionId → refit function, so tab activation can trigger a clean refit. */
const fitFns = new Map<string, () => void>();

interface Cell {
  col: number;
  row: number; // absolute buffer row
}

interface Props {
  sessionId: string;
  active: boolean;
}

async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** One xterm per session, created once and kept alive; switching tabs only
 * toggles visibility so scrollback and running programs stay intact. */
export default function TermView({ sessionId, active }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const [handles, setHandles] = useState<{ a: Cell; b: Cell } | null>(null);
  const [showBar, setShowBar] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, setScrollTick] = useState(0);
  const suppressKeyboard = useDeck((s) => s.suppressKeyboard);
  const followOutput = useDeck((s) => s.followOutput);
  const followRefs = new Map<string, { current: boolean }>();

  // Create once per session.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const term = new Terminal({
      theme: DARK,
      fontFamily: '"JetBrains Mono", "Roboto Mono", "Fira Code", ui-monospace, Menlo, Monaco, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowTransparency: true,
      macOptionIsMeta: true,
      rightClickSelectsWord: false,
    });
    termRef.current = term;

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    term.onData((data) => deckSocket.send({ type: 'input', sessionId, data }));

    const fitNow = () => {
      if (host.clientWidth > 0 && host.clientHeight > 0) {
        fit.fit();
        // High-precision physical grid auto-fit with hardware safe margin
        const core = (term as unknown as { _core?: { _renderService?: { dimensions?: { actualCellWidth: number } } } })._core;
        const cellWidth = core?._renderService?.dimensions?.actualCellWidth || 0;
        if (cellWidth > 0) {
          const SAFE_PAD_X = 10; // 5px breathing room on each side
          const availWidth = Math.max(10, host.clientWidth - SAFE_PAD_X);
          const safeCols = Math.max(10, Math.floor(availWidth / cellWidth));
          if (safeCols < term.cols) {
            term.resize(safeCols, term.rows);
          }
        }
        deckSocket.send({ type: 'resize', sessionId, cols: term.cols, rows: term.rows });
      }
    };
    fitFns.set(sessionId, fitNow);

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        requestAnimationFrame(fitNow);
      });
    } else {
      fitNow();
    }


    // ---- follow output -----------------------------------------------------
    const followRef = { current: followOutput };
    followRefs.set(sessionId, followRef);
    term.onScroll(() => {
      if (!useDeck.getState().followOutput) {
        followRef.current = false;
        return;
      }
      const buf = term.buffer.active;
      followRef.current = buf.baseY - buf.viewportY <= 1;
    });

    let selecting = false;
    let parked: string[] = [];
    let selectMoveOrigin: { x: number; y: number } | null = null;
    const SELECT_MOVE_THRESHOLD = 18;

    const off = deckSocket.onMessage((msg) => {
      if (msg.type === 'output' && msg.sessionId === sessionId) {
        if (selecting) {
          parked.push(msg.data);
          return;
        }
        term.write(msg.data, () => {
          if (followRefs.get(sessionId)?.current) term.scrollToBottom();
        });
      }
      if (msg.type === 'exit' && msg.sessionId === sessionId) {
        term.write(`\r\n\x1b[33m[会话已退出 code=${msg.exitCode}]\x1b[0m\r\n`);
      }
    });

    // ---- long-press selection ---------------------------------------------
    const LONG_PRESS_MS = 400;
    const SCROLL_CANCEL_PX = 15;
    let pressTimer: number | null = null;
    let pressPoint: { x: number; y: number } | null = null;
    let gesture: 'idle' | 'pressed' | 'selecting' = 'idle';
    let primaryId: number | null = null;
    let dragWhich: 'a' | 'b' | null = null;
    let fixedCell: Cell | null = null;
    let dragFrame: number | null = null;
    let dragPointer: { x: number; y: number } | null = null;
    const anchorCellRef: { current: Cell | null } = { current: null };

    const nativeScroll = () =>
      !(term as unknown as { coreMouseService?: { areMouseEventsActive?: boolean } })
        .coreMouseService?.areMouseEventsActive;

    const screen = () => host.querySelector('.xterm-screen');
    const cellAt = (x: number, y: number): Cell | null => {
      const scr = screen();
      if (!scr) return null;
      const rect = scr.getBoundingClientRect();
      const cw = rect.width / Math.max(term.cols, 1);
      const ch = rect.height / Math.max(term.rows, 1);
      const col = Math.max(0, Math.min(term.cols - 1, Math.floor((x - rect.left) / cw)));
      const vRow = Math.max(0, Math.min(term.rows - 1, Math.floor((y - rect.top) / ch)));
      const vy = term.buffer.active.viewportY || 0;
      return { col, row: vy + vRow };
    };

    const normalize = (p1: Cell, p2: Cell): { start: Cell; end: Cell } => {
      if (p1.row < p2.row || (p1.row === p2.row && p1.col <= p2.col)) {
        return { start: p1, end: p2 };
      }
      return { start: p2, end: p1 };
    };

    const applySelection = (p1: Cell, p2: Cell) => {
      const { start, end } = normalize(p1, p2);
      const vy = term.buffer.active.viewportY || 0;
      const startVRow = start.row - vy;
      const endVRow = end.row - vy;
      if (start.row === end.row) {
        term.select(start.col, startVRow, end.col - start.col + 1);
      } else {
        const length = (end.row - start.row) * term.cols + (end.col - start.col) + 1;
        term.select(start.col, startVRow, length);
      }
      setHandles({ a: start, b: end });
    };

    const stepDragScroll = () => {
      dragFrame = null;
      if (!dragWhich || !dragPointer) return;
      const scr = screen();
      if (!scr) return;
      const rect = scr.getBoundingClientRect();
      const EDGE_ZONE = 32;
      let scrollBy = 0;
      if (dragPointer.y < rect.top + EDGE_ZONE) {
        scrollBy = -1;
      } else if (dragPointer.y > rect.bottom - EDGE_ZONE) {
        scrollBy = 1;
      }
      if (scrollBy !== 0) {
        term.scrollLines(scrollBy);
        const moving = cellAt(dragPointer.x, dragPointer.y);
        if (moving && fixedCell) {
          applySelection(fixedCell, moving);
        }
      }
      dragFrame = requestAnimationFrame(stepDragScroll);
    };

    const startDragScroll = () => {
      if (dragFrame === null) dragFrame = requestAnimationFrame(stepDragScroll);
    };
    const stopDragScroll = () => {
      if (dragFrame !== null) {
        cancelAnimationFrame(dragFrame);
        dragFrame = null;
      }
    };

    const handleAtPoint = (target: EventTarget | null): 'a' | 'b' | null => {
      if (!(target instanceof HTMLElement)) return null;
      const handle = target.closest('.sel-handle');
      if (!handle) return null;
      const which = handle.getAttribute('data-which');
      return which === 'a' || which === 'b' ? which : null;
    };

    const onHostTouchStart = (event: TouchEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('.sel-bar')) return;

      const which = handleAtPoint(target);
      if (which && handlesRef.current) {
        event.preventDefault();
        event.stopPropagation();
        dragWhich = which;
        const current = handlesRef.current;
        fixedCell = which === 'a' ? current.b : current.a;
        primaryId = event.touches[0]?.identifier ?? null;
        setShowBar(false);
        return;
      }

      if (gesture === 'selecting') return;

      if (event.touches.length === 1 && nativeScroll()) {
        const t = event.touches[0];
        primaryId = t.identifier;
        pressPoint = { x: t.clientX, y: t.clientY };
        gesture = 'pressed';

        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = window.setTimeout(() => {
          pressTimer = null;
          if (gesture !== 'pressed' || !pressPoint) return;
          const hit = cellAt(pressPoint.x, pressPoint.y);
          if (!hit) return;

          navigator.vibrate?.(40);
          gesture = 'selecting';
          selecting = true;
          parked = [];
          selectMoveOrigin = pressPoint;

          const vy = term.buffer.active.viewportY || 0;
          const startRow = Math.max(vy, hit.row - 1);
          const endRow = Math.min(vy + term.rows - 1, hit.row + 1);
          const p1: Cell = { col: 0, row: startRow };
          const p2: Cell = { col: Math.max(0, term.cols - 1), row: endRow };
          anchorCellRef.current = hit;
          applySelection(p1, p2);
          setShowBar(false);
        }, LONG_PRESS_MS);
      }
    };

    const onHostTouchMove = (event: TouchEvent) => {
      if (dragWhich) {
        event.preventDefault();
        event.stopPropagation();
        const t = [...event.touches].find((x) => x.identifier === primaryId) || event.touches[0];
        if (!t) return;
        dragPointer = { x: t.clientX, y: t.clientY };
        const moving = cellAt(t.clientX, t.clientY);
        if (moving && fixedCell) {
          applySelection(fixedCell, moving);
        }
        startDragScroll();
        return;
      }

      if (gesture === 'selecting') {
        event.preventDefault();
        event.stopPropagation();
        const t = [...event.touches].find((x) => x.identifier === primaryId) || event.touches[0];
        if (!t) return;
        if (selectMoveOrigin) {
          const travel = Math.hypot(t.clientX - selectMoveOrigin.x, t.clientY - selectMoveOrigin.y);
          if (travel < SELECT_MOVE_THRESHOLD) return;
          selectMoveOrigin = null;
        }
        dragPointer = { x: t.clientX, y: t.clientY };
        const moving = cellAt(t.clientX, t.clientY);
        const anchor = anchorCellRef.current;
        if (moving && anchor) {
          applySelection(anchor, moving);
        }
        startDragScroll();
        return;
      }

      if (nativeScroll()) event.stopPropagation();
      const t = event.touches[0];
      if (!t) return;
      if (gesture === 'pressed' && pressPoint) {
        const dx = t.clientX - pressPoint.x;
        const dy = t.clientY - pressPoint.y;
        const verticalIntent = Math.abs(dy) >= 8 && Math.abs(dy) > Math.abs(dx);
        if (Math.hypot(dx, dy) > SCROLL_CANCEL_PX || verticalIntent) {
          if (pressTimer) clearTimeout(pressTimer);
          pressTimer = null;
          gesture = 'idle';
        }
      }
    };

    const onHostTouchEnd = (event: TouchEvent) => {
      if (dragWhich) {
        const t = [...event.changedTouches].find((x) => x.identifier === primaryId);
        if (primaryId === null || t) {
          dragWhich = null;
          fixedCell = null;
          dragPointer = null;
          stopDragScroll();
        }
        return;
      }
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      if (gesture === 'selecting') {
        const stillDown = [...event.touches].some((x) => x.identifier === primaryId);
        if (stillDown) return;
        gesture = 'idle';
        primaryId = null;
        selecting = false;
        dragPointer = null;
        stopDragScroll();
        for (const chunk of parked) {
          term.write(chunk, () => {
            if (followRefs.get(sessionId)?.current) term.scrollToBottom();
          });
        }
        parked = [];
        if (term.hasSelection()) setShowBar(true);
      } else {
        gesture = 'idle';
        primaryId = null;
        if (nativeScroll()) event.stopPropagation();
      }
    };

    host.addEventListener('touchstart', onHostTouchStart, { passive: false, capture: true });
    host.addEventListener('touchmove', onHostTouchMove, { passive: false, capture: true });
    host.addEventListener('touchend', onHostTouchEnd, { passive: true, capture: true });
    host.addEventListener('touchcancel', onHostTouchEnd, { passive: true, capture: true });

    const ro = new ResizeObserver(() => requestAnimationFrame(fitNow));
    ro.observe(host);
    deckSocket.attach(sessionId);

    return () => {
      off();
      ro.disconnect();
      if (pressTimer) clearTimeout(pressTimer);
      stopDragScroll();
      host.removeEventListener('touchstart', onHostTouchStart, true);
      host.removeEventListener('touchmove', onHostTouchMove, true);
      host.removeEventListener('touchend', onHostTouchEnd, true);
      host.removeEventListener('touchcancel', onHostTouchEnd, true);
      fitFns.delete(sessionId);
      followRefs.delete(sessionId);
      term.dispose();
    };
  }, [sessionId]);

  const handlesRef = useRef<{ a: Cell; b: Cell } | null>(null);
  handlesRef.current = handles;

  useEffect(() => {
    const ref = followRefs.get(sessionId);
    if (termRef.current && ref) ref.current = followOutput;
  }, [followOutput, sessionId]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const w = term.onSelectionChange(() => {
      if (!term.hasSelection()) {
        setHandles(null);
        setShowBar(false);
      }
    });
    const vp = hostRef.current?.querySelector('.xterm-viewport');
    let bump: (() => void) | null = null;
    if (vp) {
      bump = () => setScrollTick((t) => t + 1);
      vp.addEventListener('scroll', bump);
    }
    return () => {
      w.dispose();
      if (bump && vp) vp.removeEventListener('scroll', bump);
    };
  }, [sessionId, active]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const apply = () => {
      const ta = host.querySelector('textarea');
      if (!ta) return false;
      if (suppressKeyboard) {
        ta.setAttribute('readonly', 'true');
        ta.setAttribute('inputmode', 'none');
      } else {
        ta.removeAttribute('readonly');
        ta.removeAttribute('inputmode');
      }
      return true;
    };
    if (!apply()) {
      const t = window.setTimeout(apply, 150);
      return () => clearTimeout(t);
    }
  }, [suppressKeyboard, sessionId, active]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.style.visibility = active ? 'visible' : 'hidden';
    if (active) requestAnimationFrame(() => fitFns.get(sessionId)?.());
  }, [active, sessionId]);


  const handleCoords = (which: 'a' | 'b') => {
    if (!handles) return null;
    const term = termRef.current;
    const host = hostRef.current;
    const scr = host?.querySelector('.xterm-screen');
    if (!term || !host || !scr) return null;
    const cell = handles[which];
    const hostRect = host.getBoundingClientRect();
    const rect = scr.getBoundingClientRect();
    const cw = rect.width / Math.max(term.cols, 1);
    const ch = rect.height / Math.max(term.rows, 1);
    const vy = term.buffer.active.viewportY || 0;
    if (cell.row < vy || cell.row >= vy + term.rows) return null;
    return {
      left: rect.left - hostRect.left + cell.col * cw,
      top: rect.top - hostRect.top + (cell.row - vy) * ch,
    };
  };
  const posA = handleCoords('a');
  const posB = handleCoords('b');

  const doCopy = async () => {
    const term = termRef.current;
    if (!term) return;
    const ok = await copyText(term.getSelection());
    if (ok) {
      navigator.vibrate?.(20);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  };
  const doSelectAll = () => {
    termRef.current?.selectAll();
    setHandles(null);
  };
  const doCancel = () => {
    termRef.current?.clearSelection();
    setHandles(null);
    setShowBar(false);
  };

  return (
    <div className="term-host absolute inset-0 h-full w-full" ref={hostRef}>
      {handles && posA && (
        <div className="sel-handle start" style={{ left: posA.left, top: posA.top }} data-which="a" />
      )}
      {handles && posB && (
        <div className="sel-handle end" style={{ left: posB.left, top: posB.top }} data-which="b" />
      )}
      {showBar && (
        <div className="sel-bar">
          <button onClick={() => void doCopy()} className="sel-bar-btn primary">
            {copied ? '已复制✓' : '复制'}
          </button>
          <button onClick={doSelectAll} className="sel-bar-btn">全选</button>
          <button onClick={doCancel} className="sel-bar-btn">取消</button>
        </div>
      )}
    </div>
  );
}

const followRefs = new Map<string, { current: boolean }>();
