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
  // Translucent so selected text stays readable under the highlight.
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
    /* fall through to legacy path (HTTP LAN / older browsers) */
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
  // Bumped on every terminal scroll: handle positions are derived from the
  // live viewport, and without this re-render the handles stay pinned to the
  // old screen position while the text scrolls away underneath them.
  const [, setScrollTick] = useState(0);
  const suppressKeyboard = useDeck((s) => s.suppressKeyboard);
  const followOutput = useDeck((s) => s.followOutput);

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
    termRef.current = term;
    term.onData((data) => deckSocket.send({ type: 'input', sessionId, data }));

    const fitNow = () => {
      try {
        fit.fit();
        if (term.cols >= 2 && term.rows >= 2) {
          // FitAddon measures the cell width with one rounding and the DOM
          // renderer paints with another; on some devicePixelRatio × font
          // size combos the painted grid ends up WIDER than the container
          // and the last column gets clipped. Self-heal: shrink by a column
          // while overflowing, then try to reclaim any full spare column.
          const hostEl = host;
          const scr = hostEl.querySelector('.xterm-screen') as HTMLElement | null;
          if (scr) {
            let guard = 0;
            while (scr.getBoundingClientRect().width > hostEl.clientWidth + 0.5 && term.cols > 2 && guard++ < 4) {
              term.resize(term.cols - 1, term.rows);
            }
            guard = 0;
            while (
              scr.getBoundingClientRect().width + hostEl.clientWidth / term.cols <= hostEl.clientWidth &&
              guard++ < 4
            ) {
              const before = term.cols;
              term.resize(term.cols + 1, term.rows);
              if (scr.getBoundingClientRect().width > hostEl.clientWidth + 0.5) {
                term.resize(before, term.rows); // overflowed — step back
                break;
              }
            }
          }
          deckSocket.send({ type: 'resize', sessionId, cols: term.cols, rows: term.rows });
        }
      } catch {
        /* container hidden or zero-size */
      }
    };
    fitFns.set(sessionId, fitNow);
    fitNow();

    // ---- follow output -----------------------------------------------------
    const followRef = { current: followOutput };
    followRefs.set(sessionId, followRef);
    term.onScroll(() => {
      if (!useDeck.getState().followOutput) {
        followRef.current = false; // user turned follow off — respect it
        return;
      }
      const buf = term.buffer.active;
      // Rejoin follow when the user scrolls back near the bottom; leaving the
      // bottom (any manual scroll) releases it.
      followRef.current = buf.baseY - buf.viewportY <= 1;
    });

    // While selecting, incoming output is parked and flushed after the
    // selection ends — the screen must stay frozen under the user's handles.
    let selecting = false;
    let parked: string[] = [];
    /** Finger travel since the long-press fired; below this threshold the
     * selection is not updated, so natural hand tremor never collapses the
     * freshly created 3-row selection back to the press point. */
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
    const LONG_PRESS_MS = 400; // native-app standard; 250ms fires mid-scroll-start
    const SCROLL_CANCEL_PX = 15; // finger travel that means "this is a scroll"
    let pressTimer: number | null = null;
    let pressPoint: { x: number; y: number } | null = null;
    let gesture: 'idle' | 'pressed' | 'selecting' = 'idle';
    let primaryId: number | null = null;
    let dragWhich: 'a' | 'b' | null = null;
    let fixedCell: Cell | null = null;
    let dragFrame: number | null = null;
    let dragPointer: { x: number; y: number } | null = null;
    const anchorCellRef: { current: Cell | null } = { current: null };

    // Native scrolling is active whenever the child app isn't reporting mouse
    // events (htop/vim translate touches into clicks — those must reach xterm).
    // areMouseEventsActive is an internal xterm field but stable across 5.x;
    // if it ever disappears we fall back to native scrolling (shell default).
    const nativeScroll = () =>
      !(term as unknown as { coreMouseService?: { areMouseEventsActive?: boolean } })
        .coreMouseService?.areMouseEventsActive;

    const screen = () => host.querySelector('.xterm-screen');
    const cellAt = (x: number, y: number): Cell | null => {
      const scr = screen();
      if (!scr) return null;
      const rect = scr.getBoundingClientRect();
      const cw = rect.width / Math.max(term.cols, 1);
      const chh = rect.height / Math.max(term.rows, 1);
      const vy = term.buffer.active.viewportY || 0;
      const col = Math.max(0, Math.min(term.cols - 1, Math.floor((x - rect.left) / cw)));
      const row = Math.max(0, Math.min(term.rows - 1, Math.floor((y - rect.top) / chh)));
      return { col, row: row + vy };
    };
    const selectBetween = (a: Cell, b: Cell) => {
      const ai = a.row * term.cols + a.col;
      const bi = b.row * term.cols + b.col;
      const first = Math.min(ai, bi);
      const last = Math.max(ai, bi);
      term.select(first % term.cols, Math.floor(first / term.cols), Math.max(1, last - first + 1));
      setHandles({
        a: { col: first % term.cols, row: Math.floor(first / term.cols) },
        b: { col: last % term.cols, row: Math.floor(last / term.cols) },
      });
    };
    const applyDrag = () => {
      if (!dragWhich || !fixedCell || !dragPointer) return;
      const cur = cellAt(dragPointer.x, dragPointer.y);
      if (!cur) return;
      if (dragWhich === 'a') selectBetween(cur, fixedCell);
      else selectBetween(fixedCell, cur);
    };
    const dragAutoScroll = () => {
      if (!dragPointer || !screen()) {
        dragFrame = null;
        return;
      }
      const rect = screen()!.getBoundingClientRect();
      const edge = 44;
      let speed = 0;
      if (dragPointer.y < rect.top + edge) speed = -Math.max(1, Math.ceil((rect.top + edge - dragPointer.y) / 10));
      else if (dragPointer.y > rect.bottom - edge) speed = Math.max(1, Math.ceil((dragPointer.y - (rect.bottom - edge)) / 10));
      if (!speed) {
        dragFrame = null;
        return;
      }
      term.scrollLines(speed);
      applyDrag();
      dragFrame = requestAnimationFrame(dragAutoScroll);
    };
    const stopDragScroll = () => {
      if (dragFrame) cancelAnimationFrame(dragFrame);
      dragFrame = null;
    };

    const onHostTouchStart = (event: TouchEvent) => {
      const target = event.target as HTMLElement;
      const handleEl = target?.closest?.('.sel-handle') as HTMLElement | null;
      if (handleEl) {
        // Dragging one of the handles: the other end stays fixed.
        event.preventDefault();
        event.stopPropagation();
        if (!term.hasSelection()) return;
        const t = event.touches[0];
        if (!t) return;
        stopDragScroll();
        dragWhich = handleEl.classList.contains('start') ? 'a' : 'b';
        dragPointer = { x: t.clientX, y: t.clientY };
        const ends = currentEnds();
        if (!ends) return;
        fixedCell = dragWhich === 'a' ? ends.b : ends.a;
        applyDrag();
        stopDragScroll();
        dragFrame = requestAnimationFrame(dragAutoScroll);
        return;
      }
      if (!screen() || event.touches.length > 1) return;
      if (nativeScroll()) {
        // Keep xterm's touch handlers out of the way: its touchstart calls
        // preventDefault, which would cancel the browser's native scroll
        // gesture before it even starts.
        event.stopPropagation();
      } else {
        return; // mouse mode: touches belong to xterm's click translation
      }
      const t = event.touches[0];
      pressPoint = { x: t.clientX, y: t.clientY };
      primaryId = t.identifier;
      gesture = 'pressed';
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = window.setTimeout(() => {
        if (gesture !== 'pressed' || !pressPoint) return;
        gesture = 'selecting';
        selecting = true;
        parked = [];
        selectMoveOrigin = pressPoint;
        const vy = term.buffer.active.viewportY || 0;
        // Keep both handles comfortably inside the screen: ≥2 cells from the
        // left/right edges and ≥1 row from the top/bottom — handles hugging
        // the bezel are impossible to grab.
        const clampCol = (c: number) => Math.max(2, Math.min(term.cols - 3, c));
        const clampRow = (r: number) => Math.max(vy + 1, Math.min(vy + term.rows - 2, r));
        const startCell = cellAt(pressPoint.x, pressPoint.y);
        if (!startCell) return;
        anchorCellRef.current = {
          col: clampCol(startCell.col),
          row: clampRow(startCell.row),
        };
        // The second handle sits 5 cells across and 3 rows down from the
        // press point; when there is no room below, it goes 3 rows up instead.
        const a = anchorCellRef.current;
        const roomBelow = a.row + 3 <= vy + term.rows - 2;
        const b: Cell = {
          col: clampCol(a.col + 5),
          row: clampRow(roomBelow ? a.row + 3 : a.row - 3),
        };
        selectBetween(a, b);
        navigator.vibrate?.(15);
      }, LONG_PRESS_MS);
    };

    const onHostTouchMove = (event: TouchEvent) => {
      if (dragWhich) {
        event.preventDefault();
        event.stopPropagation();
        const t = event.touches[0];
        if (t) dragPointer = { x: t.clientX, y: t.clientY };
        applyDrag();
        if (!dragFrame) dragFrame = requestAnimationFrame(dragAutoScroll);
        return;
      }
      if (gesture === 'selecting') {
        event.preventDefault();
        event.stopPropagation();
        const t = [...event.touches].find((x) => x.identifier === primaryId);
        if (!t) return;
        // Ignore tremor: only finger travel beyond the threshold starts
        // stretching the selection.
        if (selectMoveOrigin) {
          const travel = Math.hypot(t.clientX - selectMoveOrigin.x, t.clientY - selectMoveOrigin.y);
          if (travel < SELECT_MOVE_THRESHOLD) return;
        }
        dragPointer = { x: t.clientX, y: t.clientY };
        const anchor = anchorCellRef.current;
        if (anchor) {
          const cur = cellAt(dragPointer.x, dragPointer.y);
          if (cur) selectBetween(anchor, cur);
          stopDragScroll();
          dragFrame = requestAnimationFrame(dragAutoScroll);
        }
        return;
      }
      // Scroll path (pressed or already idle): keep xterm's 1:1 touch
      // scrolling out of the way — the compositor owns the gesture now.
      if (nativeScroll()) event.stopPropagation();
      const t = event.touches[0];
      if (!t) return;
      if (gesture === 'pressed' && pressPoint) {
        const dx = t.clientX - pressPoint.x;
        const dy = t.clientY - pressPoint.y;
        // Vertical intent cancels the pending long-press immediately: a slow
        // scroll start must never grow into an accidental selection.
        const verticalIntent = Math.abs(dy) >= 8 && Math.abs(dy) > Math.abs(dx);
        if (Math.hypot(dx, dy) > SCROLL_CANCEL_PX || verticalIntent) {
          if (pressTimer) clearTimeout(pressTimer);
          pressTimer = null;
          gesture = 'idle'; // it's a scroll, let the browser have it
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
        // Only the primary finger ending the gesture finishes selection; a
        // lifted second finger just means the endpoint returns to the anchor.
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
        // Stop xterm's touchend handler (it calls preventDefault, which would
        // suppress the synthesized tap that focuses the terminal).
        if (nativeScroll()) event.stopPropagation();
      }
    };

    const currentEnds = () => {
      // Read back the live selection ends from our own state mirror.
      return handlesRef.current;
    };

    host.addEventListener('touchstart', onHostTouchStart, { passive: false, capture: true });
    host.addEventListener('touchmove', onHostTouchMove, { passive: false, capture: true });
    host.addEventListener('touchend', onHostTouchEnd, { passive: true, capture: true });
    host.addEventListener('touchcancel', onHostTouchEnd, { passive: true, capture: true });

    const ro = new ResizeObserver(() => requestAnimationFrame(fitNow));
    ro.observe(host);
    // Attach only AFTER our message handler is registered — otherwise the
    // server's prompt/replay can arrive before anyone is listening (this is
    // why the 2nd+ session used to open blank).
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
    // followOutput intentionally not a dep: followRef is synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Mirror selection ends for the gesture code (which lives in the effect).
  const handlesRef = useRef<{ a: Cell; b: Cell } | null>(null);
  handlesRef.current = handles;

  // Keep followRef in sync with the store toggle.
  useEffect(() => {
    const ref = followRefs.get(sessionId);
    if (termRef.current && ref) ref.current = followOutput;
  }, [followOutput, sessionId]);

  // Hide/copy-bar cleanup when selection disappears externally.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const w = term.onSelectionChange(() => {
      if (!term.hasSelection()) {
        setHandles(null);
        setShowBar(false);
      }
    });
    // Native viewport scroll listener: any scroll (touch, wheel, programmatic)
    // must recompute handle screen positions, or they stay pinned to the old
    // spot while the text moves underneath.
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

  // Suppress the system keyboard when requested.
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

  // Hide/show on tab switch; refit when becoming visible (geometry may have
  // changed while hidden).
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
    if (cell.row < vy || cell.row >= vy + term.rows) return null; // end scrolled away
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
    setHandles(null); // whole buffer has no meaningful endpoints
  };
  const doCancel = () => {
    termRef.current?.clearSelection();
    setHandles(null);
    setShowBar(false);
  };

  // Absolutely stacked inside <main>(relative): every session occupies the
  // full area, visibility decides who shows. In-flow stacking would push the
  // 2nd+ terminals below the clip and look "blank".
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

/** sessionId → live follow flag shared between the store toggle and the
 * write callback inside the creation effect. */
const followRefs = new Map<string, { current: boolean }>();
