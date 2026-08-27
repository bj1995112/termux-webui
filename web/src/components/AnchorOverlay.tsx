import React, { useMemo } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { TranslationAnchor } from '../lib/streamPipeline.js';

interface Props {
  term: Terminal | null;
  anchors: TranslationAnchor[];
  visible?: boolean;
}

export const AnchorOverlay: React.FC<Props> = ({ term, anchors, visible = true }) => {
  const visibleAnchors = useMemo(() => {
    if (!term || !visible || anchors.length === 0) return [];
    const buf = term.buffer.active;
    const viewportY = buf.viewportY;
    const rows = term.rows;

    return anchors.filter(
      (a) => a.bufferRow >= viewportY && a.bufferRow < viewportY + rows,
    );
  }, [term, anchors, visible]);

  if (!term || !visible || visibleAnchors.length === 0) return null;

  const core = (
    term as unknown as {
      _core?: {
        _renderService?: {
          dimensions?: { actualCellWidth: number; actualCellHeight: number };
        };
      };
    }
  )._core;

  const dims = core?._renderService?.dimensions;
  const cellWidth = dims?.actualCellWidth || (term.options.fontSize || 13) * 0.6;
  const cellHeight = dims?.actualCellHeight || (term.options.fontSize || 13) * 1.25;

  const screenEl = term.element?.querySelector('.xterm-screen') as HTMLElement | null;
  const rowsEl = term.element?.querySelector('.xterm-rows') as HTMLElement | null;
  const screenOffsetLeft = screenEl?.offsetLeft ?? 0;
  const screenOffsetTop = screenEl?.offsetTop ?? 0;
  const rowDivs = rowsEl ? (Array.from(rowsEl.children) as HTMLElement[]) : [];

  const buf = term.buffer.active;
  const viewportY = buf.viewportY;
  const themeBg = term.options.theme?.background || '#1a1b26';

  return (
    <div
      className="absolute inset-0 z-30 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {visibleAnchors.map((anchor) => {
        const rowIdx = anchor.bufferRow - viewportY;
        const targetDiv = rowDivs[rowIdx];

        // Pixel-perfect physical DOM coordinates
        const top = targetDiv
          ? targetDiv.offsetTop + screenOffsetTop
          : rowIdx * cellHeight + screenOffsetTop;
        const height = targetDiv ? targetDiv.offsetHeight : cellHeight;
        const left = screenOffsetLeft + anchor.startCol * cellWidth;

        // Solid background mask to completely conceal underlying English characters
        const minMaskWidth = (anchor.endCol - anchor.startCol) * cellWidth;

        // Direct ANSI & Terminal State Check for Active Selected Option
        let isAnsiSelected = false;
        const line = buf.getLine(anchor.bufferRow);
        if (line) {
          // Check if any character cell in this anchor has inverse or highlight background
          const checkLen = Math.min(line.length, anchor.endCol);
          for (let col = anchor.startCol; col < checkLen; col += 1) {
            const cell = line.getCell(col);
            if (cell) {
              if (cell.isInverse() || (cell.getBgColor() !== -1 && cell.getBgColor() !== 0)) {
                isAnsiSelected = true;
                break;
              }
            }
          }
          // Also check text marker (❯, >, ●, *, ✔, [x])
          const rawText = line.translateToString(true);
          if (/[❯>●*✔✓]|\[x\]|\[\*\]/i.test(rawText)) {
            isAnsiSelected = true;
          }
        }

        return (
          <div
            key={anchor.id}
            style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              height: `${height}px`,
              lineHeight: `${height}px`,
              minWidth: `${minMaskWidth}px`,
              padding: '0 6px',
              whiteSpace: 'pre',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: term.options.fontFamily || 'monospace',
              fontSize: `${term.options.fontSize}px`,
              // Distinct visual styles for active selected item vs regular items
              color: isAnsiSelected ? '#ffffff' : 'var(--text, #c0caf5)',
              fontWeight: isAnsiSelected ? 700 : 400,
              background: isAnsiSelected ? 'rgba(59, 130, 246, 0.40)' : themeBg,
              borderLeft: isAnsiSelected ? '4px solid #3b82f6' : 'none',
              boxShadow: isAnsiSelected ? '0 0 16px rgba(59, 130, 246, 0.45)' : 'none',
              borderRadius: isAnsiSelected ? '3px' : '0px',
              zIndex: isAnsiSelected ? 40 : 35,
              transition: 'background 0.08s ease, border-color 0.08s ease, color 0.08s ease',
            }}
          >
            {anchor.translatedText}
          </div>
        );
      })}
    </div>
  );
};
