import type { Terminal } from '@xterm/xterm';
import { RICH_DICT } from './dict.js';

export interface SimpleFocus {
  raw: string;
  badge: string;
  command: string;
  text: string;
  instantTranslation: string | null;
}

/**
 * Dead-Simple, 100% Reliable Cursor & Option Extractor:
 * 1. Finds the highlighted/pointer line (or cursor line).
 * 2. Grabs the line text directly.
 * 3. Checks instant dictionary or prepares for translation.
 */
export function extractActiveLine(term: Terminal): SimpleFocus | null {
  try {
    const buf = term.buffer.active;
    const totalLines = buf.length;
    const viewportY = buf.viewportY;
    const rows = term.rows;
    const cursorAbs = buf.baseY + buf.cursorY;

    let targetRow = -1;

    // Scan visible lines for pointer: >, ›, ❯, ➜, ●, [x], 1.
    for (let r = 0; r < rows; r++) {
      const abs = viewportY + r;
      if (abs >= totalLines) break;
      const line = buf.getLine(abs);
      if (!line) continue;
      const str = line.translateToString(true).trim();
      if (!str) continue;

      if (/^[>›❯➜➔→▶●*✔√]\s*/.test(str) || /^\s*(\/[a-zA-Z0-9_\-]+|\[[\*xX]\]|\([•\*xX]\))\s*/.test(str)) {
        targetRow = abs;
      }
    }

    // Fallback: cursor line
    if (targetRow === -1 && cursorAbs < totalLines) {
      const curLine = buf.getLine(cursorAbs);
      if (curLine) {
        const curStr = curLine.translateToString(true).trim();
        if (curStr && !/[@\w\.\-]+:[~\w\/\.\-]+[\$#>]\s*$/.test(curStr)) {
          targetRow = cursorAbs;
        }
      }
    }

    if (targetRow === -1) return null;

    const line = buf.getLine(targetRow);
    if (!line) return null;

    let full = line.translateToString(true).trim();
    // Gather soft-wrapped continuation line if any
    let nextR = targetRow + 1;
    while (nextR < totalLines) {
      const nextLine = buf.getLine(nextR);
      if (nextLine && nextLine.isWrapped) {
        full += ' ' + nextLine.translateToString(true).trim();
        nextR++;
      } else {
        break;
      }
    }

    // Strip leading pointer symbols
    const clean = full.replace(/^[>›❯➜➔→▶●*✔√\s]+/, '').trim();
    if (!clean || clean.length <= 1) return null;

    // Match dictionary
    const lower = clean.toLowerCase();
    for (const [k, entry] of Object.entries(RICH_DICT)) {
      if (lower === k || lower.startsWith(k + ' ') || lower.startsWith(k + ':') || lower.startsWith(k + '-')) {
        return {
          raw: full,
          badge: entry.badge,
          command: entry.title,
          text: clean,
          instantTranslation: entry.explanation,
        };
      }
    }

    // Parse slash command format
    const slashMatch = clean.match(/^(\/[a-zA-Z0-9_\-]+)\s*(?:[-–—:]\s*)?(.*)$/);
    if (slashMatch) {
      return {
        raw: full,
        badge: '【命令】',
        command: slashMatch[1],
        text: slashMatch[2].trim() || slashMatch[1],
        instantTranslation: null,
      };
    }

    // Parse numbered option format
    const numMatch = clean.match(/^((?:\[\d+\]|\d+[\.\)]|[a-zA-Z][\.\)]))\s*(?:[-–—:]\s*)?(.*)$/);
    if (numMatch) {
      return {
        raw: full,
        badge: `【选项 ${numMatch[1].replace(/[\.\)\[\]]/g, '')}】`,
        command: numMatch[1],
        text: numMatch[2].trim() || clean,
        instantTranslation: null,
      };
    }

    return {
      raw: full,
      badge: '【焦点】',
      command: '',
      text: clean,
      instantTranslation: null,
    };
  } catch {
    return null;
  }
}
