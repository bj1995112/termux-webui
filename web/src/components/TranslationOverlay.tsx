import { useEffect, useState, useRef, useCallback } from 'react';
import type { Terminal } from '@xterm/xterm';
import { useDeck } from '../store.js';

interface Props {
  term: Terminal | null;
  onClose: () => void;
}

interface BlockTranslation {
  id: number;
  original: string;
  translated: string;
  loading: boolean;
}

export default function TranslationOverlay({ term, onClose }: Props) {
  const [blocks, setBlocks] = useState<BlockTranslation[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [mode, setMode] = useState<'bilingual' | 'live_hud'>('bilingual');
  const [autoLive, setAutoLive] = useState(true);

  const translateText = useDeck((s) => s.translateText);
  const fontSize = useDeck((s) => s.fontSize);
  const overlayRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const lastCapturedHashRef = useRef<string>('');

  const captureAndTranslate = useCallback(async () => {
    if (!term) return;

    const buf = term.buffer.active;
    const vy = buf.viewportY || 0;
    const rowCount = term.rows;

    const rawParagraphs: string[] = [];
    let currentLines: string[] = [];

    for (let r = 0; r < rowCount; r++) {
      const line = buf.getLine(vy + r);
      const str = line ? line.translateToString(true) : '';
      if (!str.trim()) {
        if (currentLines.length > 0) {
          rawParagraphs.push(currentLines.join('\n'));
          currentLines = [];
        }
      } else {
        currentLines.push(str);
      }
    }
    if (currentLines.length > 0) {
      rawParagraphs.push(currentLines.join('\n'));
    }

    const currentHash = rawParagraphs.join('|||');
    if (currentHash === lastCapturedHashRef.current && blocks.length > 0) {
      return; // Output hasn't changed, skip network call
    }
    lastCapturedHashRef.current = currentHash;

    if (rawParagraphs.length === 0) {
      setBlocks([]);
      return;
    }

    setIsTranslating(true);

    const initialBlocks: BlockTranslation[] = rawParagraphs.map((p, idx) => ({
      id: idx,
      original: p,
      translated: blocks[idx]?.original === p ? blocks[idx].translated : p,
      loading: blocks[idx]?.original === p ? false : true,
    }));
    setBlocks(initialBlocks);

    // Concurrent batch translation with smart caching
    const promises = rawParagraphs.map(async (p, idx) => {
      if (blocks[idx]?.original === p && blocks[idx]?.translated !== p) {
        return { id: idx, translated: blocks[idx].translated };
      }
      try {
        const translated = await translateText(p);
        return { id: idx, translated };
      } catch {
        return { id: idx, translated: p };
      }
    });

    const results = await Promise.all(promises);

    setBlocks((prev) =>
      prev.map((b) => {
        const match = results.find((r) => r.id === b.id);
        return match ? { ...b, translated: match.translated, loading: false } : { ...b, loading: false };
      }),
    );
    setIsTranslating(false);
  }, [term, translateText, blocks]);

  // 1. Initial capture
  useEffect(() => {
    void captureAndTranslate();
  }, [term, fontSize]);

  // 2. Real-time Auto Tracking: listen to terminal output stream
  useEffect(() => {
    if (!term || !autoLive) return;

    const scheduleUpdate = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = window.setTimeout(() => {
        void captureAndTranslate();
      }, 500); // 500ms debounce during user typing & output
    };

    const disp1 = term.onLineFeed(scheduleUpdate);
    const disp2 = term.onWriteParsed(scheduleUpdate);

    return () => {
      disp1.dispose();
      disp2.dispose();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [term, autoLive, captureAndTranslate]);

  if (!term) return null;

  return (
    <>
      {/* Top Floating Control Capsule (Non-blocking) */}
      <div className="absolute top-2 right-3 z-40 flex items-center gap-1.5 rounded-full border border-accent/40 bg-panel2/95 px-2.5 py-1 text-xs shadow-2xl backdrop-blur-md">
        <button
          onClick={() => setAutoLive(!autoLive)}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
            autoLive
              ? 'bg-accent text-white shadow-sm ring-2 ring-accent/30'
              : 'bg-panel text-muted hover:text-text border border-border'
          }`}
          title="开启后边操作边自动翻译新出现的词与输出"
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${autoLive ? 'bg-white animate-pulse' : 'bg-muted'}`} />
          <span>{autoLive ? '⚡ 边敲边译' : '⏸ 已暂停'}</span>
        </button>

        <button
          onClick={() => setMode(mode === 'bilingual' ? 'live_hud' : 'bilingual')}
          className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-medium text-text border border-border hover:border-accent"
          title="切换视图模式"
        >
          {mode === 'bilingual' ? '📖 双语流' : '💬 实时底栏'}
        </button>

        <button
          onClick={() => void captureAndTranslate()}
          disabled={isTranslating}
          className="rounded-full bg-panel px-1.5 py-0.5 text-[10px] text-muted hover:text-text disabled:opacity-50 border border-border"
          title="手动刷新当前画面"
        >
          {isTranslating ? '⏳' : '🔄'}
        </button>

        <button
          onClick={onClose}
          className="flex h-4 w-4 items-center justify-center rounded-full text-muted hover:text-red-400 active:scale-95"
          title="退出实时翻译"
        >
          ✕
        </button>
      </div>

      {/* Mode A: Bilingual Non-blocking Feed (Semi-transparent, allows reading alongside typing) */}
      {mode === 'bilingual' ? (
        <div
          ref={overlayRef}
          style={{ fontSize: `${fontSize}px` }}
          className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-panel/85 backdrop-blur-[2px] font-mono leading-[1.35] text-text select-text transition-opacity duration-150 pt-10 pb-16 px-3 space-y-2.5"
        >
          {blocks.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-muted">
              <p>终端暂无内容，请在键盘上输入命令...</p>
            </div>
          ) : (
            blocks.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-border/50 bg-panel2/70 p-2.5 shadow-sm transition-all"
              >
                {/* Original English */}
                <div className="whitespace-pre-wrap break-words font-mono text-muted/80 text-[0.9em] mb-1 select-text">
                  {b.original}
                </div>
                {/* Real-time Chinese Translation */}
                <div className="whitespace-pre-wrap break-words font-sans text-text font-semibold bg-accent/15 border border-accent/30 rounded-lg p-2 text-[0.95em] select-text">
                  <span className="text-[10px] font-bold text-accent block mb-0.5">
                    🇨🇳 中文释义：
                  </span>
                  {b.translated}
                  {b.loading && (
                    <span className="ml-2 text-[10px] text-accent animate-pulse">
                      (正在翻译新词...)
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Mode B: Live Bottom Subtitle HUD (Leaves terminal 100% visible & fully interactive) */
        <div className="absolute bottom-12 left-2 right-2 z-30 max-h-48 overflow-y-auto rounded-2xl border border-accent/40 bg-panel/95 p-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-border/40 pb-1.5 mb-2">
            <span className="font-bold text-accent text-xs flex items-center gap-1.5">
              <span>🌐 实时终端字幕 (一边操作一边看)</span>
              {isTranslating && <span className="text-[10px] font-normal text-muted animate-pulse">正在翻译...</span>}
            </span>
          </div>
          <div className="space-y-2 font-sans text-xs">
            {blocks.slice(-3).map((b) => (
              <div key={b.id} className="bg-accent/10 border border-accent/20 p-2 rounded-xl">
                <div className="font-mono text-[10px] text-muted truncate mb-0.5">{b.original.split('\n')[0]}</div>
                <div className="font-medium text-text">{b.translated}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
