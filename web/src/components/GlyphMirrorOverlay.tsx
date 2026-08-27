import { useEffect, useState, useRef, useCallback } from 'react';
import type { Terminal } from '@xterm/xterm';
import { useDeck } from '../store.js';

interface Props {
  term: Terminal | null;
  onClose: () => void;
}

interface RowState {
  rowIndex: number; // 0 to rows - 1 (relative to viewport)
  originalText: string;
  translatedText: string;
}

export default function GlyphMirrorOverlay({ term, onClose }: Props) {
  const [rows, setRows] = useState<RowState[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [geometry, setGeometry] = useState<{
    cellHeight: number;
    cellWidth: number;
    left: number;
    top: number;
  }>({ cellHeight: 16.25, cellWidth: 8, left: 0, top: 0 });

  const translateText = useDeck((s) => s.translateText);
  const fontSize = useDeck((s) => s.fontSize);

  // Cache: original raw line text -> translated text
  const lineCacheRef = useRef<Map<string, string>>(new Map());
  // Previous viewport frame cache: row index -> text
  const prevViewportRef = useRef<string[]>([]);
  const debounceTimerRef = useRef<number | null>(null);

  /** Update precise xterm geometry */
  const updateGeometry = useCallback(() => {
    if (!term) return;
    const core = (term as unknown as {
      _core?: {
        _renderService?: {
          dimensions?: { actualCellWidth: number; actualCellHeight: number };
        };
      };
    })._core;

    const actualH = core?._renderService?.dimensions?.actualCellHeight;
    const actualW = core?._renderService?.dimensions?.actualCellWidth;

    const termElement = term.element;
    const screenElement = termElement?.querySelector('.xterm-screen');

    let left = 0;
    let top = 0;
    if (termElement && screenElement) {
      const termRect = termElement.getBoundingClientRect();
      const screenRect = screenElement.getBoundingClientRect();
      left = Math.max(0, screenRect.left - termRect.left);
      top = Math.max(0, screenRect.top - termRect.top);
    }

    const finalCellHeight = actualH && actualH > 0 ? actualH : fontSize * 1.25;
    const finalCellWidth = actualW && actualW > 0 ? actualW : fontSize * 0.6;

    setGeometry({
      cellHeight: finalCellHeight,
      cellWidth: finalCellWidth,
      left,
      top,
    });
  }, [term, fontSize]);

  /** Incremental Row Diffing & Precise Patching Engine */
  const diffAndPatchRows = useCallback(async () => {
    if (!term) return;
    updateGeometry();

    const buf = term.buffer.active;
    const vy = buf.viewportY || 0;
    const rowCount = term.rows;

    const currentLines: string[] = [];
    const dirtyIndices: number[] = [];

    // 1. Scan current visible viewport rows
    for (let r = 0; r < rowCount; r++) {
      const line = buf.getLine(vy + r);
      const str = line ? line.translateToString(true) : '';
      currentLines.push(str);

      // Diff against previous frame: identify dirty rows
      if (prevViewportRef.current[r] !== str) {
        dirtyIndices.push(r);
      }
    }

    // If nothing changed, zero work needed
    if (dirtyIndices.length === 0 && rows.length > 0) {
      return;
    }
    prevViewportRef.current = currentLines;

    // 2. Identify which dirty rows need translation
    const linesToTranslate: { index: number; text: string }[] = [];
    const nextRows: RowState[] = currentLines.map((text, r) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return { rowIndex: r, originalText: text, translatedText: text };
      }
      const cached = lineCacheRef.current.get(trimmed);
      if (cached) {
        const leading = text.match(/^\s*/)?.[0] || '';
        return { rowIndex: r, originalText: text, translatedText: leading + cached };
      }
      // Need translation
      linesToTranslate.push({ index: r, text: trimmed });
      // Temporary display original until translated
      return { rowIndex: r, originalText: text, translatedText: text };
    });

    setRows(nextRows);

    if (linesToTranslate.length === 0) {
      return;
    }

    setIsTranslating(true);

    // 3. Translate only the changed / dirty rows
    const promises = linesToTranslate.map(async (item) => {
      try {
        const translated = await translateText(item.text);
        lineCacheRef.current.set(item.text, translated);
        return { index: item.index, text: item.text, translated };
      } catch {
        return { index: item.index, text: item.text, translated: item.text };
      }
    });

    const results = await Promise.all(promises);

    // 4. Patch only the translated rows
    setRows((prev) => {
      const updated = [...prev];
      for (const res of results) {
        const row = updated[res.index];
        if (row && row.originalText.trim() === res.text) {
          const leading = row.originalText.match(/^\s*/)?.[0] || '';
          updated[res.index] = {
            ...row,
            translatedText: leading + res.translated,
          };
        }
      }
      return updated;
    });

    setIsTranslating(false);
  }, [term, translateText, rows.length, updateGeometry]);

  const scheduleUpdate = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      void diffAndPatchRows();
    }, 120); // 120ms debounce for lightning fast response
  }, [diffAndPatchRows]);

  // Initial patch & resize geometry updates
  useEffect(() => {
    updateGeometry();
    void diffAndPatchRows();
  }, [term, fontSize, updateGeometry]);

  // Real-time incremental listener: terminal output & scroll
  useEffect(() => {
    if (!term) return;

    const d1 = term.onRender(scheduleUpdate);
    const d2 = term.onScroll(scheduleUpdate);
    const d3 = term.onLineFeed(scheduleUpdate);
    const d4 = term.onResize(() => {
      updateGeometry();
      scheduleUpdate();
    });

    return () => {
      d1.dispose();
      d2.dispose();
      d3.dispose();
      d4.dispose();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [term, scheduleUpdate, updateGeometry]);

  if (!term) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden select-none">
      {/* Top Floating Control Capsule (Clickable via pointer-events-auto) */}
      <div className="pointer-events-auto absolute top-2 right-3 z-40 flex items-center gap-1.5 rounded-full border border-accent/40 bg-panel2/90 px-2.5 py-1 text-xs shadow-xl backdrop-blur-md">
        <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
        <span className="font-bold text-accent text-[11px]">🌐 谷歌式原地汉化</span>
        {isTranslating && (
          <span className="text-[10px] text-muted animate-pulse">⚡...</span>
        )}
        <button
          onClick={onClose}
          className="flex h-4 w-4 items-center justify-center rounded-full text-muted hover:text-red-400 active:scale-95 ml-1"
          title="还原为原生英文"
        >
          ✕
        </button>
      </div>

      {/* 1:1 Pixel-Perfect In-Place Glyph Mirror Rows */}
      <div
        style={{
          position: 'absolute',
          top: `${geometry.top}px`,
          left: `${geometry.left}px`,
          fontSize: `${fontSize}px`,
          fontFamily: '"JetBrains Mono", "Roboto Mono", "Fira Code", ui-monospace, Menlo, Monaco, monospace',
        }}
        className="pointer-events-none overflow-hidden"
      >
        {rows.map((r) => {
          const isBlank = !r.originalText.trim();
          const hasTranslation = r.translatedText !== r.originalText;

          if (isBlank || !hasTranslation) {
            return null;
          }

          const topPos = r.rowIndex * geometry.cellHeight;

          return (
            <div
              key={r.rowIndex}
              style={{
                position: 'absolute',
                top: `${topPos}px`,
                left: 0,
                height: `${geometry.cellHeight}px`,
                lineHeight: `${geometry.cellHeight}px`,
                color: 'var(--text, #c0caf5)',
                backgroundColor: 'rgba(26, 27, 38, 0.96)',
              }}
              className="whitespace-pre truncate px-0.5 rounded-sm select-none"
            >
              {r.translatedText}
            </div>
          );
        })}
      </div>
    </div>
  );
}
