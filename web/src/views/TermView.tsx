import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';
import { deckSocket } from '../lib/ws.js';
import { useDeck } from '../store.js';
import { THEMES } from '../theme.js';
import { TerminalStreamPipeline, type TranslationAnchor } from '../lib/streamPipeline.js';
import { AnchorOverlay } from '../components/AnchorOverlay.js';

/** sessionId → refit function, so tab activation can trigger a clean refit. */
const fitFns = new Map<string, () => void>();

interface Cell {
  col: number;
  row: number;
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

/** Extract URL at specific terminal buffer cell */
function findUrlAtCell(term: Terminal, cell: Cell): string | null {
  try {
    const line = term.buffer.active.getLine(cell.row);
    if (!line) return null;
    const lineStr = line.translateToString(true);
    if (!lineStr) return null;

    const urlRegex = /https?:\/\/[^\s"'`<>，。！？（）()\[\]{}]+/gi;
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(lineStr)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (cell.col >= start && cell.col <= end) {
        return match[0].replace(/[.,;:!?)]+$/, '');
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Find exact word boundaries at cell */
function findWordBoundsAtCell(term: Terminal, cell: Cell): { start: Cell; end: Cell } {
  try {
    const line = term.buffer.active.getLine(cell.row);
    if (!line) return { start: cell, end: cell };
    const str = line.translateToString(true);
    if (!str) return { start: cell, end: cell };

    const len = str.length;
    let startCol = Math.min(Math.max(0, cell.col), len - 1);
    let endCol = startCol;

    const isSpace = /\s/.test(str[startCol] || '');
    if (isSpace) {
      while (startCol > 0 && /\s/.test(str[startCol - 1])) startCol--;
      while (endCol < len - 1 && /\s/.test(str[endCol + 1])) endCol++;
    } else {
      const isWordChar = (c: string) => /[a-zA-Z0-9_\-\.\/:]/.test(c);
      while (startCol > 0 && isWordChar(str[startCol - 1])) startCol--;
      while (endCol < len - 1 && isWordChar(str[endCol + 1])) endCol++;
    }

    return {
      start: { col: startCol, row: cell.row },
      end: { col: endCol, row: cell.row },
    };
  } catch {
    return { start: cell, end: cell };
  }
}

export default function TermView({ sessionId, active }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const [handles, setHandles] = useState<{ a: Cell; b: Cell } | null>(null);
  const [showBar, setShowBar] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, setScrollTick] = useState(0);
  const [isExited, setIsExited] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [zoomIndicator, setZoomIndicator] = useState<number | null>(null);
  const [selectedTranslation, setSelectedTranslation] = useState<{
    original: string;
    translated: string;
    loading: boolean;
  } | null>(null);

  const translateText = useDeck((s) => s.translateText);
  const showTranslation = useDeck((s) => s.showTranslation);
  const [anchors, setAnchors] = useState<TranslationAnchor[]>([]);
  const [renderTick, setRenderTick] = useState(0);
  const pipelineRef = useRef<TerminalStreamPipeline | null>(null);

  const suppressKeyboard = useDeck((s) => s.suppressKeyboard);
  const followOutput = useDeck((s) => s.followOutput);
  const currentTheme = useDeck((s) => s.currentTheme);
  const fontSize = useDeck((s) => s.fontSize);
  const setFontSize = useDeck((s) => s.setFontSize);
  const restartSession = useDeck((s) => s.restartSession);
  const killSession = useDeck((s) => s.killSession);
  const showToast = useDeck((s) => s.showToast);
  const sessions = useDeck((s) => s.sessions);

  const sessionObj = sessions.find((s) => s.id === sessionId);

  // Sync initial exited state
  useEffect(() => {
    if (sessionObj?.status === 'exited') {
      setIsExited(true);
      setExitCode(sessionObj.exitCode ?? 0);
    }
  }, [sessionObj?.status, sessionObj?.exitCode]);

  // Update theme dynamically
  useEffect(() => {
    if (termRef.current) {
      const themeConfig = THEMES[currentTheme] || THEMES['tokyo-night'];
      termRef.current.options.theme = themeConfig.terminal;
    }
  }, [currentTheme]);

  // Update font size dynamically on pinch or preference change
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize;
      requestAnimationFrame(() => fitFns.get(sessionId)?.());
    }
  }, [fontSize, sessionId]);

  // Create terminal instance once per session
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const themeConfig = THEMES[currentTheme] || THEMES['tokyo-night'];
    const currentFontSize = useDeck.getState().fontSize || 13;

    const term = new Terminal({
      theme: themeConfig.terminal,
      fontFamily: '"JetBrains Mono", "Roboto Mono", "Fira Code", ui-monospace, Menlo, Monaco, monospace',
      fontSize: currentFontSize,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowTransparency: true,
      macOptionIsMeta: true,
      rightClickSelectsWord: false,
      allowProposedApi: true,
    });
    termRef.current = term;

    const fit = new FitAddon();
    term.loadAddon(fit);

    // Safe load web links addon
    try {
      const webLinks = new WebLinksAddon((_event, uri) => {
        setActiveUrl(uri);
      });
      term.loadAddon(webLinks);
    } catch (e) {
      console.warn('Failed to load WebLinksAddon', e);
    }

    // Safe load Unicode 11 for broad characters / emojis
    try {
      const unicode11 = new Unicode11Addon();
      term.loadAddon(unicode11);
      term.unicode.activeVersion = '11';
    } catch (e) {
      console.warn('Failed to load Unicode11Addon', e);
    }

    term.open(host);
    const pipeline = new TerminalStreamPipeline(term, translateText, setAnchors);
    pipelineRef.current = pipeline;
    requestAnimationFrame(() => pipeline.refresh());

    const notifyRender = () => {
      setRenderTick((t) => (t + 1) % 1000000);
    };

    term.onData((data) => {
      deckSocket.send({ type: 'input', sessionId, data });
      pipeline.onUserInput();
      notifyRender();
    });
    term.onCursorMove(() => {
      pipeline.onUserInput();
      notifyRender();
    });
    term.onRender(() => notifyRender());
    term.onLineFeed(() => notifyRender());

    const fitNow = () => {
      if (host.clientWidth > 0 && host.clientHeight > 0) {
        fit.fit();
        const core = (term as unknown as { _core?: { _renderService?: { dimensions?: { actualCellWidth: number } } } })._core;
        const cellWidth = core?._renderService?.dimensions?.actualCellWidth || 0;
        if (cellWidth > 0) {
          const SAFE_PAD_X = 10;
          const availWidth = Math.max(10, host.clientWidth - SAFE_PAD_X);
          const safeCols = Math.max(10, Math.floor(availWidth / cellWidth));
          if (safeCols < term.cols) {
            term.resize(safeCols, term.rows);
          }
        }
        deckSocket.send({ type: 'resize', sessionId, cols: term.cols, rows: term.rows });
        pipeline.refresh();
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

    const followRef = { current: followOutput };
    followRefs.set(sessionId, followRef);
    term.onScroll(() => {
      if (!useDeck.getState().followOutput) {
        followRef.current = false;
      } else {
        const buf = term.buffer.active;
        followRef.current = buf.baseY - buf.viewportY <= 1;
      }
      pipeline.feed();
    });

    let selecting = false;
    let parked: string[] = [];
    let selectMoveOrigin: { x: number; y: number } | null = null;
    const SELECT_MOVE_THRESHOLD = 18;

    // Pinch-to-zoom tracking variables
    let pinchStartDist: number | null = null;
    let pinchStartSize: number | null = null;
    let lastPinchSize: number = currentFontSize;
    let zoomHideTimer: number | null = null;

    const off = deckSocket.onMessage((msg) => {
      if (msg.type === 'output' && msg.sessionId === sessionId) {
        if (selecting) {
          parked.push(msg.data);
          return;
        }
        term.write(msg.data, () => {
          if (followRefs.get(sessionId)?.current) term.scrollToBottom();
          pipeline.feed();
        });
      }
      if (msg.type === 'exit' && msg.sessionId === sessionId) {
        setIsExited(true);
        setExitCode(msg.exitCode);
        term.write(`\r\n\x1b[33m[会话已退出 code=${msg.exitCode}]\x1b[0m\r\n`);
      }
    });

    // Long-press selection & touch interaction
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
      const core = (term as unknown as { _core?: { _renderService?: { dimensions?: { actualCellWidth: number; actualCellHeight: number } } } })._core;
      const cw = core?._renderService?.dimensions?.actualCellWidth || (rect.width / Math.max(term.cols, 1));
      const ch = core?._renderService?.dimensions?.actualCellHeight || (rect.height / Math.max(term.rows, 1));
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
      if (start.row === end.row) {
        term.select(start.col, start.row, end.col - start.col + 1);
      } else {
        const length = (end.row - start.row) * term.cols + (end.col - start.col) + 1;
        term.select(start.col, start.row, length);
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
      if (target instanceof HTMLElement && (target.closest('.sel-bar') || target.closest('.link-bar') || target.closest('.exit-banner'))) return;

      // 1. Two-finger pinch to zoom font size (Termux standard: 6px ~ 36px)
      if (event.touches.length === 2) {
        event.preventDefault();
        event.stopPropagation();
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        gesture = 'idle';
        if (zoomHideTimer) clearTimeout(zoomHideTimer);

        const t1 = event.touches[0];
        const t2 = event.touches[1];
        pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        pinchStartSize = useDeck.getState().fontSize;
        lastPinchSize = pinchStartSize;
        setZoomIndicator(pinchStartSize);
        return;
      }

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

          const bounds = findWordBoundsAtCell(term, hit);
          anchorCellRef.current = bounds.start;
          applySelection(bounds.start, bounds.end);
          setShowBar(true);
        }, LONG_PRESS_MS);
      }
    };

    const onHostTouchMove = (event: TouchEvent) => {
      // 1. Two-finger pinch zoom
      if (event.touches.length === 2 && pinchStartDist && pinchStartSize) {
        event.preventDefault();
        event.stopPropagation();
        const t1 = event.touches[0];
        const t2 = event.touches[1];
        const curDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const scale = curDist / Math.max(1, pinchStartDist);
        const target = Math.min(36, Math.max(6, Math.round(pinchStartSize * scale)));
        if (target !== lastPinchSize) {
          lastPinchSize = target;
          navigator.vibrate?.(8);
          setFontSize(target);
          setZoomIndicator(target);
        }
        return;
      }

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
      // 1. Pinch zoom finished
      if (pinchStartDist !== null && event.touches.length < 2) {
        pinchStartDist = null;
        pinchStartSize = null;
        if (zoomHideTimer) clearTimeout(zoomHideTimer);
        zoomHideTimer = window.setTimeout(() => setZoomIndicator(null), 1000);
        return;
      }

      if (dragWhich) {
        const t = [...event.changedTouches].find((x) => x.identifier === primaryId);
        if (primaryId === null || t) {
          dragWhich = null;
          fixedCell = null;
          dragPointer = null;
          stopDragScroll();
          if (term.hasSelection()) {
            setShowBar(true);
          }
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
      } else if (gesture === 'pressed' && pressPoint) {
        // Tap detected -> check if a link is tapped
        const hit = cellAt(pressPoint.x, pressPoint.y);
        if (hit) {
          const url = findUrlAtCell(term, hit);
          if (url) {
            navigator.vibrate?.(20);
            setActiveUrl(url);
          }
        }
        gesture = 'idle';
        primaryId = null;
      } else {
        gesture = 'idle';
        primaryId = null;
        if (nativeScroll()) event.stopPropagation();
      }
    };

    const onHostClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.closest('.sel-bar') || target.closest('.link-bar') || target.closest('.exit-banner'))) return;
      const hit = cellAt(event.clientX, event.clientY);
      if (hit) {
        const url = findUrlAtCell(term, hit);
        if (url) {
          setActiveUrl(url);
        }
      }
    };

    host.addEventListener('touchstart', onHostTouchStart, { passive: false, capture: true });
    host.addEventListener('touchmove', onHostTouchMove, { passive: false, capture: true });
    host.addEventListener('touchend', onHostTouchEnd, { passive: true, capture: true });
    host.addEventListener('touchcancel', onHostTouchEnd, { passive: true, capture: true });
    host.addEventListener('click', onHostClick);

    const ro = new ResizeObserver(() => requestAnimationFrame(fitNow));
    ro.observe(host);
    deckSocket.attach(sessionId);

    return () => {
      off();
      pipeline.clear();
      pipelineRef.current = null;
      ro.disconnect();
      if (pressTimer) clearTimeout(pressTimer);
      if (zoomHideTimer) clearTimeout(zoomHideTimer);
      stopDragScroll();
      host.removeEventListener('touchstart', onHostTouchStart, true);
      host.removeEventListener('touchmove', onHostTouchMove, true);
      host.removeEventListener('touchend', onHostTouchEnd, true);
      host.removeEventListener('touchcancel', onHostTouchEnd, true);
      host.removeEventListener('click', onHostClick);
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
    const core = (term as unknown as { _core?: { _renderService?: { dimensions?: { actualCellWidth: number; actualCellHeight: number } } } })._core;
    const cw = core?._renderService?.dimensions?.actualCellWidth || (rect.width / Math.max(term.cols, 1));
    const ch = core?._renderService?.dimensions?.actualCellHeight || (rect.height / Math.max(term.rows, 1));
    const vy = term.buffer.active.viewportY || 0;
    if (cell.row < vy || cell.row >= vy + term.rows) return null;
    return {
      left: rect.left - hostRect.left + (which === 'a' ? cell.col * cw : (cell.col + 1) * cw),
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

  const doTranslateSelection = async () => {
    const term = termRef.current;
    if (!term) return;
    const sel = term.getSelection().trim();
    if (!sel) return;

    setSelectedTranslation({ original: sel, translated: '正在联网翻译中...', loading: true });
    try {
      const translated = await translateText(sel);
      if (translated && translated !== sel) {
        setSelectedTranslation({ original: sel, translated, loading: false });
      } else {
        setSelectedTranslation({
          original: sel,
          translated: '暂未获取到有效中文释义。若网络公共源受限，建议在左上角菜单「系统偏好」中配置 DeepSeek API Key 开启大模型高精度翻译。',
          loading: false,
        });
      }
    } catch {
      setSelectedTranslation({
        original: sel,
        translated: '翻译请求超时。建议在左上角菜单中配置自定义 API (如 DeepSeek)。',
        loading: false,
      });
    }
  };

  const handleRestart = async () => {
    setIsExited(false);
    await restartSession(sessionId);
  };

  return (
    <div className="term-host absolute inset-0 h-full w-full" ref={hostRef}>
      {/* Real-time Dual Pipeline Translation Anchor Overlay */}
      <AnchorOverlay term={termRef.current} anchors={anchors} visible={showTranslation} renderTick={renderTick} />

      {/* Exited Notification Banner */}
      {isExited && (
        <div className="exit-banner absolute top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-panel/90 px-3.5 py-1.5 text-xs shadow-xl backdrop-blur-md">
          <span className="text-amber-400 font-bold">⚠️ 会话已退出 (code={exitCode ?? 0})</span>
          <button
            onClick={() => void handleRestart()}
            className="flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-xs font-semibold text-white active:bg-accent-hover shadow"
          >
            <span>🔄</span>
            <span>重新启动</span>
          </button>
          <button
            onClick={() => void killSession(sessionId)}
            className="rounded p-0.5 text-muted hover:text-red-400"
            title="关闭该会话"
          >
            ✕
          </button>
        </div>
      )}

      {/* Selection Translation Popup Card */}
      {selectedTranslation && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 flex w-[90%] max-w-sm flex-col gap-2 rounded-2xl border border-accent/40 bg-panel/95 p-3.5 text-xs shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
            <span className="font-bold text-accent flex items-center gap-1.5">
              <span>🌐</span>
              <span>选词翻译结果</span>
            </span>
            <button
              onClick={() => setSelectedTranslation(null)}
              className="rounded p-1 text-muted hover:text-text"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1.5 font-mono">
            <div className="text-[11px] text-muted line-clamp-3 select-text bg-panel2/60 p-2 rounded-lg border border-border/30">
              {selectedTranslation.original}
            </div>
            <div className="text-[12px] font-semibold text-text select-text bg-accent/10 p-2 rounded-lg border border-accent/20">
              {selectedTranslation.translated}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => {
                void copyText(selectedTranslation.translated);
                showToast('已复制译文', 'success');
                setSelectedTranslation(null);
              }}
              className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white shadow active:scale-95"
            >
              <span>📋</span>
              <span>复制译文</span>
            </button>
          </div>
        </div>
      )}

      {/* Pinch Zoom Floating Indicator */}
      {zoomIndicator !== null && (
        <div className="zoom-indicator pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex items-center gap-2 rounded-2xl border border-accent/40 bg-panel/95 px-4 py-2.5 text-sm font-bold text-accent shadow-2xl backdrop-blur-md animate-in zoom-in-90 duration-150">
          <span className="text-lg">🔍</span>
          <span>字体大小: {zoomIndicator}px</span>
          {zoomIndicator === 13 && <span className="text-[10px] text-muted font-normal">(默认)</span>}
        </div>
      )}

      {/* Detected URL Floating Action Bar */}
      {activeUrl && (
        <div className="link-bar absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex max-w-[92%] items-center gap-2 rounded-2xl border border-accent/40 bg-panel/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <span className="text-base">🔗</span>
          <div className="overflow-hidden">
            <span className="block truncate max-w-[170px] text-text font-mono select-all text-[11px]">
              {activeUrl}
            </span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setActiveUrl(null)}
              className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white shadow active:scale-95 transition-all"
            >
              <span>🌐</span>
              <span>打开</span>
            </a>
            <button
              onClick={() => {
                void copyText(activeUrl);
                showToast('链接已复制', 'success');
                setActiveUrl(null);
              }}
              className="flex items-center gap-1 rounded-lg border border-border bg-panel2 px-2 py-1 text-xs text-muted hover:text-text active:scale-95 transition-all"
            >
              <span>📋</span>
              <span>复制</span>
            </button>
            <button
              onClick={() => setActiveUrl(null)}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:text-text active:text-accent"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
          <button onClick={() => void doTranslateSelection()} className="sel-bar-btn">
            🌐 翻译
          </button>
          <button onClick={doSelectAll} className="sel-bar-btn">全选</button>
          <button onClick={doCancel} className="sel-bar-btn">取消</button>
        </div>
      )}
    </div>
  );
}

const followRefs = new Map<string, { current: boolean }>();
