import React, { useMemo } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { TranslationAnchor } from '../lib/streamPipeline.js';

interface Props {
  term: Terminal | null;
  anchors: TranslationAnchor[];
}

export const AnchorOverlay: React.FC<Props> = ({ term, anchors }) => {
  const visibleAnchors = useMemo(() => {
    if (!term || anchors.length === 0) return [];
    const buf = term.buffer.active;
    const viewportY = buf.viewportY;
    const rows = term.rows;

    return anchors.filter(
      (a) => a.bufferRow >= viewportY && a.bufferRow < viewportY + rows,
    );
  }, [term, anchors]);

  if (!term || visibleAnchors.length === 0) return null;

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

  const viewportY = term.buffer.active.viewportY;
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
              padding: '0 2px',
              whiteSpace: 'pre',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: term.options.fontFamily || 'monospace',
              fontSize: `${term.options.fontSize}px`,
              color: 'var(--text, #c0caf5)',
              background: themeBg,
              zIndex: 35,
            }}
          >
            {anchor.translatedText}
          </div>
        );
      })}
    </div>
  );
};
