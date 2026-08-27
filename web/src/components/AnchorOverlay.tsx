import React, { useMemo } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { TranslationAnchor } from '../lib/streamPipeline.js';

interface Props {
  term: Terminal | null;
  anchors: TranslationAnchor[];
  visible?: boolean;
  renderTick?: number;
}

/** Standard 16 ANSI Palette Color Mapping */
const ANSI_16_COLORS: string[] = [
  '#15161e', // 0: black
  '#f7768e', // 1: red
  '#9ece6a', // 2: green
  '#e0af68', // 3: yellow
  '#7aa2f7', // 4: blue
  '#bb9af7', // 5: magenta
  '#7dcfff', // 6: cyan
  '#a9b1d6', // 7: white
  '#414868', // 8: bright black (gray)
  '#f7768e', // 9: bright red
  '#9ece6a', // 10: bright green
  '#e0af68', // 11: bright yellow
  '#7aa2f7', // 12: bright blue
  '#bb9af7', // 13: bright magenta
  '#7dcfff', // 14: bright cyan
  '#c0caf5', // 15: bright white
];

/**
 * 1:1 Native Style & Color Mirroring Translation Overlay
 * Directly mirrors the original terminal cell color, bold weight, inverse highlight, and underline.
 */
export const AnchorOverlay: React.FC<Props> = ({ term, anchors, visible = true, renderTick = 0 }) => {
  const visibleAnchors = useMemo(() => {
    if (!term || !visible || anchors.length === 0) return [];
    const buf = term.buffer.active;
    const viewportY = buf.viewportY;
    const rows = term.rows;

    return anchors.filter(
      (a) => a.bufferRow >= viewportY && a.bufferRow < viewportY + rows,
    );
  }, [term, anchors, visible, renderTick]);

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
  const themeFg = term.options.theme?.foreground || '#c0caf5';

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

        // Solid background mask width to completely cover underlying English characters
        const minMaskWidth = (anchor.endCol - anchor.startCol) * cellWidth;

        // --- 1:1 Native Style & Color Extraction from Physical Buffer Cell ---
        let textColor = themeFg;
        let bgColor = themeBg;
        let isBold = false;
        let isDim = false;
        let isUnderline = false;
        let isInverse = false;

        const line = buf.getLine(anchor.bufferRow);
        if (line) {
          // Inspect cell attributes around the start of the anchor
          const checkCol = Math.min(anchor.startCol, Math.max(0, line.length - 1));
          const cell = line.getCell(checkCol);
          if (cell) {
            isBold = Boolean(cell.isBold());
            isDim = Boolean(cell.isDim());
            isUnderline = Boolean(cell.isUnderline());
            isInverse = Boolean(cell.isInverse());

            // 1. Resolve Foreground Color
            if (cell.isFgRGB()) {
              const rgb = cell.getFgColor();
              const r = (rgb >> 16) & 0xff;
              const g = (rgb >> 8) & 0xff;
              const b = rgb & 0xff;
              textColor = `rgb(${r}, ${g}, ${b})`;
            } else if (cell.isFgPalette()) {
              const pal = cell.getFgColor();
              if (pal >= 0 && pal < 16) {
                textColor = ANSI_16_COLORS[pal] || themeFg;
              }
            }

            // 2. Resolve Background Color
            if (cell.isBgRGB()) {
              const rgb = cell.getBgColor();
              const r = (rgb >> 16) & 0xff;
              const g = (rgb >> 8) & 0xff;
              const b = rgb & 0xff;
              bgColor = `rgb(${r}, ${g}, ${b})`;
            } else if (cell.isBgPalette()) {
              const pal = cell.getBgColor();
              if (pal >= 0 && pal < 16) {
                bgColor = ANSI_16_COLORS[pal] || themeBg;
              }
            }

            // 3. Handle ANSI Inverse Video (\x1b[7m)
            if (isInverse) {
              const temp = textColor;
              textColor = bgColor === themeBg ? '#1a1b26' : bgColor;
              bgColor = temp === themeFg ? '#c0caf5' : temp;
              isBold = true;
            }
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
              padding: '0 2px',
              whiteSpace: 'pre',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: term.options.fontFamily || 'monospace',
              fontSize: `${term.options.fontSize}px`,
              // 100% 1:1 Mirror Native Styles
              color: textColor,
              background: bgColor,
              fontWeight: isBold ? 700 : 400,
              textDecoration: isUnderline ? 'underline' : 'none',
              opacity: isDim ? 0.65 : 1,
              zIndex: isInverse ? 40 : 35,
              transition: 'background 0.05s ease, color 0.05s ease',
            }}
          >
            {anchor.translatedText}
          </div>
        );
      })}
    </div>
  );
};
