import { useEffect, useState, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import { useDeck } from '../store.js';

interface Props {
  term: Terminal | null;
  onClose: () => void;
}

interface BlockTranslation {
  id: number;
  originalLines: string[];
  translatedText: string;
  loading: boolean;
}

export default function TranslationOverlay({ term, onClose }: Props) {
  const [blocks, setBlocks] = useState<BlockTranslation[]>([]);
  const [viewMode, setViewMode] = useState<'bilingual' | 'replace'>('bilingual');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const translateText = useDeck((s) => s.translateText);
  const fontSize = useDeck((s) => s.fontSize);
  const overlayRef = useRef<HTMLDivElement>(null);

  const captureAndTranslate = async () => {
    if (!term) return;
    setIsRefreshing(true);

    const buf = term.buffer.active;
    const vy = buf.viewportY || 0;
    const rowCount = term.rows;

    // 1. Extract non-empty lines and group them into logical paragraph blocks
    const paragraphBlocks: { id: number; lines: string[] }[] = [];
    let currentBlock: string[] = [];
    let blockId = 0;

    for (let r = 0; r < rowCount; r++) {
      const line = buf.getLine(vy + r);
      const str = line ? line.translateToString(true) : '';
      if (!str.trim()) {
        if (currentBlock.length > 0) {
          paragraphBlocks.push({ id: blockId++, lines: currentBlock });
          currentBlock = [];
        }
      } else {
        currentBlock.push(str);
      }
    }
    if (currentBlock.length > 0) {
      paragraphBlocks.push({ id: blockId++, lines: currentBlock });
    }

    if (paragraphBlocks.length === 0) {
      setBlocks([]);
      setIsRefreshing(false);
      return;
    }

    // Initialize state
    setBlocks(
      paragraphBlocks.map((b) => ({
        id: b.id,
        originalLines: b.lines,
        translatedText: b.lines.join('\n'),
        loading: true,
      })),
    );

    // 2. Perform batched contextual translation (1 request per paragraph or combined)
    const promises = paragraphBlocks.map(async (b) => {
      const combined = b.lines.join('\n');
      try {
        const translated = await translateText(combined);
        return { id: b.id, translated };
      } catch {
        return { id: b.id, translated: combined };
      }
    });

    const results = await Promise.all(promises);

    setBlocks((prev) =>
      prev.map((item) => {
        const match = results.find((r) => r.id === item.id);
        return match
          ? { ...item, translatedText: match.translated, loading: false }
          : { ...item, loading: false };
      }),
    );
    setIsRefreshing(false);
  };

  useEffect(() => {
    void captureAndTranslate();
  }, [term, fontSize]);

  if (!term) return null;

  return (
    <div
      ref={overlayRef}
      style={{ fontSize: `${fontSize}px` }}
      className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-panel/92 backdrop-blur-md font-mono leading-[1.35] text-text select-text transition-opacity duration-150"
    >
      {/* Ultra-compact Top Floating Control Bar */}
      <div className="sticky top-1.5 z-40 mx-auto flex items-center gap-1.5 rounded-full border border-accent/40 bg-panel2/95 px-3 py-1 text-xs shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="font-bold text-accent text-[11px]">🌐 原位翻译</span>
        </div>

        <div className="h-3 w-px bg-border/60 mx-1" />

        {/* View Mode Toggle: Bilingual / Replace */}
        <button
          onClick={() => setViewMode(viewMode === 'bilingual' ? 'replace' : 'bilingual')}
          className="flex items-center gap-1 rounded-full bg-panel px-2.5 py-0.5 text-[11px] font-medium text-text hover:border-accent border border-border transition-colors"
          title="切换显示模式"
        >
          <span>{viewMode === 'bilingual' ? '📖 双语对照' : '🇨🇳 纯中文'}</span>
        </button>

        <button
          onClick={() => void captureAndTranslate()}
          disabled={isRefreshing}
          className="flex items-center gap-0.5 rounded-full bg-panel px-2 py-0.5 text-[11px] text-muted hover:text-text active:scale-95 disabled:opacity-50 border border-border"
          title="重新抓取当前视口并翻译"
        >
          <span>{isRefreshing ? '⏳' : '🔄'}</span>
          <span>{isRefreshing ? '翻译中' : '刷新'}</span>
        </button>

        <button
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-red-500/20 hover:text-red-400 active:scale-95 ml-0.5"
          title="切回原生终端"
        >
          ✕
        </button>
      </div>

      {/* Paragraph Rendered Stream */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-left">
        {blocks.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            <p>当前视口无输出内容</p>
          </div>
        ) : (
          blocks.map((b) => (
            <div
              key={b.id}
              className="group rounded-xl border border-border/50 bg-panel2/40 p-2.5 shadow-sm transition-all hover:border-accent/40"
            >
              {/* Mode 1: Bilingual (Original English on top, Chinese translation beneath) */}
              {viewMode === 'bilingual' ? (
                <div className="space-y-1.5">
                  {/* Original Terminal Text */}
                  <div className="whitespace-pre-wrap break-words font-mono text-muted/90 opacity-80 select-text">
                    {b.originalLines.join('\n')}
                  </div>

                  {/* Translated Text Block */}
                  <div className="whitespace-pre-wrap break-words font-sans text-text font-medium bg-accent/10 border border-accent/20 rounded-lg p-2 select-text">
                    <span className="text-[10px] font-bold text-accent block mb-0.5">
                      🇨🇳 译文：
                    </span>
                    {b.translatedText}
                    {b.loading && (
                      <span className="ml-2 text-[11px] text-accent animate-pulse">
                        (翻译中...)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Mode 2: In-place Pure Translated Text */
                <div className="whitespace-pre-wrap break-words font-sans text-text font-medium select-text">
                  {b.translatedText}
                  {b.loading && (
                    <span className="ml-2 text-[11px] text-accent animate-pulse">
                      ...
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
