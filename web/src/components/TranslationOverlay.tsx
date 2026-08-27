import { useEffect, useState, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import { useDeck } from '../store.js';

interface Props {
  term: Terminal | null;
  onClose: () => void;
}

interface TranslatedLine {
  lineIndex: number;
  original: string;
  translated: string;
  loading: boolean;
}

export default function TranslationOverlay({ term, onClose }: Props) {
  const [lines, setLines] = useState<TranslatedLine[]>([]);
  const [expandedLine, setExpandedLine] = useState<number | null>(null);
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
    const rawLines: { index: number; text: string }[] = [];

    for (let r = 0; r < rowCount; r++) {
      const line = buf.getLine(vy + r);
      const str = line ? line.translateToString(true) : '';
      rawLines.push({ index: r, text: str });
    }

    // Initialize state with original text
    const initialLines: TranslatedLine[] = rawLines.map((l) => ({
      lineIndex: l.index,
      original: l.text,
      translated: l.text,
      loading: Boolean(l.text.trim()),
    }));
    setLines(initialLines);

    // Group non-empty consecutive lines for contextual translation
    const promises = rawLines.map(async (l) => {
      const trimmed = l.text.trim();
      if (!trimmed) {
        return { index: l.index, translated: l.text };
      }
      const tr = await translateText(trimmed);
      // Preserve leading whitespace indentation
      const leadingSpaces = l.text.match(/^\s*/)?.[0] || '';
      return { index: l.index, translated: leadingSpaces + tr };
    });

    const results = await Promise.all(promises);

    setLines((prev) =>
      prev.map((item) => {
        const match = results.find((r) => r.index === item.lineIndex);
        return match
          ? { ...item, translated: match.translated, loading: false }
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
      className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-panel/90 backdrop-blur-md font-mono leading-[1.25] text-text select-text transition-opacity duration-200"
    >
      {/* Top Floating Control Capsule */}
      <div className="sticky top-2 z-40 mx-auto flex items-center gap-2 rounded-xl border border-accent/40 bg-panel2/95 px-3 py-1.5 text-xs shadow-2xl backdrop-blur-md animate-in slide-in-from-top-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="font-bold text-accent">🌐 终端原位翻译 ({fontSize}px)</span>
        </div>
        <div className="h-3 w-px bg-border/60 mx-1" />
        <button
          onClick={() => void captureAndTranslate()}
          disabled={isRefreshing}
          className="flex items-center gap-1 rounded bg-panel px-2 py-0.5 text-[11px] text-muted hover:text-text active:scale-95 disabled:opacity-50"
          title="重新抓取当前视口并翻译"
        >
          <span>{isRefreshing ? '⏳' : '🔄'}</span>
          <span>{isRefreshing ? '翻译中...' : '刷新'}</span>
        </button>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted hover:text-red-400 active:scale-95 ml-1"
          title="切回原生终端"
        >
          ✕
        </button>
      </div>

      {/* 1:1 In-Place Rendered Lines Viewport */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0 text-left">
        {lines.map((l) => {
          const isBlank = !l.original.trim();
          const isExpanded = expandedLine === l.lineIndex;

          return (
            <div
              key={l.lineIndex}
              onClick={() => setExpandedLine(isExpanded ? null : l.lineIndex)}
              style={{ minHeight: `${Math.round(fontSize * 1.25)}px` }}
              className={`group relative whitespace-pre-wrap break-words rounded px-1.5 transition-colors cursor-pointer ${
                isBlank ? 'opacity-20' : 'hover:bg-accent/10 active:bg-accent/20'
              } ${isExpanded ? 'bg-panel2/90 ring-1 ring-accent/40' : ''}`}
            >
              {/* Translated Text (Default In-Place) */}
              <div className="flex items-start">
                <span className="flex-1 text-text leading-tight">
                  {l.translated}
                </span>
                {l.loading && (
                  <span className="ml-2 text-[10px] text-accent animate-pulse">
                    ...
                  </span>
                )}
              </div>

              {/* Expanded In-Place Bilingual Card */}
              {isExpanded && !isBlank && (
                <div className="my-1.5 rounded-lg border border-border/80 bg-panel p-2 text-xs shadow-lg space-y-1.5 select-text">
                  <div>
                    <span className="text-[10px] font-bold text-muted block">
                      🇺🇸 原文 (English):
                    </span>
                    <p className="font-mono text-muted" style={{ fontSize: `${fontSize}px` }}>{l.original}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-accent block">
                      🇨🇳 译文 (Chinese):
                    </span>
                    <p className="font-mono text-text" style={{ fontSize: `${fontSize}px` }}>{l.translated}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
