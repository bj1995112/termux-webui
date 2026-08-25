import { useCallback, useEffect, useRef, useState } from 'react';
import { deckSocket } from '../lib/ws.js';

interface KeyDef {
  label: string;
  seq: string | null; // null → modifier toggle
}

const key = (label: string, seq: string | null): KeyDef => ({ label, seq });

const PAGES = [
  { id: 'core', label: '核心' },
  { id: 'edit', label: '编辑' },
  { id: 'actions', label: '操作' },
  { id: 'symbols', label: '符号' },
] as const;

const CORE_KEYS = [
  key('Esc', '\x1b'), key('Tab', '\t'), key('Ctrl', null), key('Alt', null), key('Shift', null),
  key('⌫', '\x7f'), key('Enter', '\r'),
];
const NAV_KEYS = [
  key('Home', '\x1b[H'), key('↑', '\x1b[A'), key('End', '\x1b[F'),
  key('←', '\x1b[D'), key('↓', '\x1b[B'), key('→', '\x1b[C'),
];
const COMBO_KEYS = [
  key('Ctrl+C', '\x03'), key('Ctrl+D', '\x04'), key('Ctrl+L', '\x0c'), key('Ctrl+Z', '\x1a'),
];
const EDIT_KEYS = [
  key('Ctrl+A', '\x01'), key('Ctrl+E', '\x05'), key('Ctrl+U', '\x15'), key('Ctrl+K', '\x0b'),
  key('Ctrl+W', '\x17'), key('Ctrl+R', '\x12'), key('Ctrl+B', '\x02'), key('Ctrl+F', '\x06'),
  ...NAV_KEYS, key('Del', '\x1b[3~'), key('⇧Tab', '\x1b[Z'),
];
const SYMBOL_KEYS = '|/\\-_~`"\':;&*$><=+.,#()[]{}'.split('').map((c) => key(c, c));

export default function QuickKeyboard({
  sessionId,
  onHide,
}: {
  sessionId: string;
  onHide: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ id: number; x: number; y: number; item: KeyDef; swiped: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [mods, setMods] = useState({ ctrl: false, alt: false, shift: false });
  const displayPages = [PAGES[PAGES.length - 1], ...PAGES, PAGES[0]];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.clientWidth;
  }, []);

  const send = useCallback(
    (seq: string) => {
      deckSocket.send({ type: 'input', sessionId, data: seq });
      navigator.vibrate?.(10);
    },
    [sessionId],
  );

  const sendKey = useCallback(
    (item: KeyDef) => {
      let seq = item.seq ?? '';
      if (mods.ctrl && item.label.length === 1) {
        const code = item.label.toUpperCase().charCodeAt(0);
        if (code >= 64 && code <= 95) seq = String.fromCharCode(code - 64);
      } else if (mods.alt && item.seq) {
        seq = `\x1b${item.seq}`;
      } else if (mods.shift && item.label.length === 1) {
        seq = item.label.toUpperCase();
      }
      send(seq);
      setMods({ ctrl: false, alt: false, shift: false });
    },
    [mods, send],
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !el.clientWidth) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx === 0) {
      el.scrollTo({ left: PAGES.length * el.clientWidth });
      setPage(PAGES.length - 1);
    } else if (idx === displayPages.length - 1) {
      el.scrollTo({ left: el.clientWidth });
      setPage(0);
    } else {
      setPage(idx - 1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gotoPage = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: (idx + 1) * el.clientWidth, behavior: 'smooth' });
  }, []);

  const copySelection = useCallback(() => {
    window.dispatchEvent(new CustomEvent('termux-webui-copy-selection'));
  }, []);

  const pasteClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard?.readText();
      if (text) send(text);
    } catch {
      /* clipboard permission optional on plain HTTP */
    }
  }, [send]);

  const renderKey = useCallback(
    (k: KeyDef) => (
      <button
        key={k.label + (k.seq ?? '')}
        className={`flex h-full min-h-[44px] items-center justify-center rounded-md border border-border bg-panel2 px-0.5 text-[13px] active:bg-accent/30 ${
          k.seq === null ? 'text-muted' : ''
        }`}
        onPointerDown={(e) => {
          e.preventDefault();
          pointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, item: k, swiped: false };
        }}
        onPointerMove={(e) => {
          const p = pointerRef.current;
          if (p && p.id === e.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) p.swiped = true;
        }}
        onPointerUp={() => {
          const p = pointerRef.current;
          pointerRef.current = null;
          if (!p || p.swiped) return;
          if (p.item.seq === null) {
            const name = p.item.label.toLowerCase() as 'ctrl' | 'alt' | 'shift';
            setMods((m) => ({ ...m, [name]: !m[name] }));
          } else {
            sendKey(p.item);
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className={mods[k.label.toLowerCase() as 'ctrl' | 'alt' | 'shift'] ? 'font-bold text-accent' : ''}>
          {k.label}
        </span>
      </button>
    ),
    [mods, sendKey],
  );

  const ActionButton = useCallback(
    ({ label, onClick }: { label: string; onClick: () => void }) => (
      <button
        onClick={onClick}
        className="flex h-full min-h-[44px] items-center justify-center rounded-md border border-border bg-panel2 text-[13px] active:bg-accent/30"
      >
        {label}
      </button>
    ),
    [],
  );

  return (
    <div className="select-none border-t border-border bg-panel pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className="flex gap-1.5">
          {PAGES.map((p, i) => (
            <button
              key={p.id}
              onClick={() => gotoPage(i)}
              aria-label={p.label}
              className={`h-2 w-2 rounded-full ${i === page ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>
        <span className="ml-auto text-xs text-muted">{PAGES[page]?.label}</span>
        <button onClick={onHide} className="rounded border border-border px-2 py-0.5 text-xs text-muted active:text-text">
          ∨ 收起
        </button>
      </div>

      <div
        ref={scrollRef}
        className="mk-pages flex overflow-x-auto"
        style={{ height: '156px', touchAction: 'pan-x' }}
        onScroll={handleScroll}
      >
        {displayPages.map((p, di) => (
          <div key={`${p.id}-${di}`} className="h-full w-full flex-shrink-0 px-1.5 py-1">
            {p.id === 'core' ? (
              <div className="flex h-full flex-col gap-1">
                <div className="grid flex-1 grid-cols-7 gap-1">{CORE_KEYS.map(renderKey)}</div>
                <div className="grid flex-1 grid-cols-6 gap-1">{NAV_KEYS.map((k) => renderKey(k))}</div>
                <div className="grid flex-1 grid-cols-4 gap-1">{COMBO_KEYS.map((k) => renderKey(k))}</div>
              </div>
            ) : p.id === 'edit' ? (
              <div className="grid h-full grid-cols-4 grid-rows-3 gap-1">{EDIT_KEYS.map(renderKey)}</div>
            ) : p.id === 'actions' ? (
              <div className="grid h-full grid-cols-4 grid-rows-3 gap-1">
                <ActionButton label="复制选中" onClick={copySelection} />
                <ActionButton label="粘贴" onClick={() => void pasteClipboard()} />
                {renderKey(key('清屏', '\x0c'))}
                <ActionButton label="全选" onClick={() => window.dispatchEvent(new CustomEvent('termux-webui-select-all'))} />
                {renderKey(key('Home', '\x1b[H'))}
                {renderKey(key('End', '\x1b[F'))}
                <ActionButton label="ABC键盘" onClick={() => document.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea')?.focus()} />
                {renderKey(key('^Z', '\x1a'))}
                <ActionButton label="隐藏键盘" onClick={onHide} />
                <ActionButton label="" onClick={() => {}} />
                <ActionButton label="" onClick={() => {}} />
                <ActionButton label="" onClick={() => {}} />
              </div>
            ) : (
              <div className="grid h-full grid-cols-8 grid-rows-3 gap-1">{SYMBOL_KEYS.map(renderKey)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
