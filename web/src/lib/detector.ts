import type { Terminal } from '@xterm/xterm';
import { lookupRichDict, type DictEntry } from './dict.js';

export interface FocusItem {
  raw: string;
  badge: string;
  command: string;
  explanation: string;
  instant: boolean;
}

// All modern CLI pointer glyphs (Ink, Inquirer, Claude Code, Gum, Bubbletea)
const POINTER_CHARS = '[>›❯➜➔→▶●○✔√*■◆»•]';

/** Check if a line represents the start of an option */
function isOptionStart(lineStr: string): boolean {
  const p = POINTER_CHARS;
  const re = new RegExp(
    `^\\s*(${p}|\\d+[\\.\\)]|\\[\\d+\\]|\\[[\\*xX\\s]\\]|\\([•\\*xX\\s]\\)|\\/[a-zA-Z0-9_\\-]+)`
  );
  return re.test(lineStr) || /^[─━=\-_#~]{3,}$/.test(lineStr);
}

/**
 * Universal Hardware & Visual Cursor Option Detector:
 * 1. Scans hardware inverse cells & all unicode CLI pointer glyphs (❯, ›, >, ➜, ●, etc.).
 * 2. Cleanses pointers thoroughly so dictionary matching hits 100% reliably.
 * 3. Dynamically gathers all wrapped/continuation lines belonging to this option.
 */
export function detectFocusedOption(term: Terminal): FocusItem | null {
  try {
    const buf = term.buffer.active;
    const viewportY = buf.viewportY;
    const totalRows = term.rows;
    const totalLines = buf.length;
    const cursorAbs = buf.baseY + buf.cursorY;

    let targetAbsRow = -1;

    // 1. Scan visible viewport lines for hardware highlight or pointers
    for (let r = 0; r < totalRows; r++) {
      const absRow = viewportY + r;
      if (absRow >= totalLines) break;
      const line = buf.getLine(absRow);
      if (!line) continue;

      const str = line.translateToString(true).trim();
      if (!str) continue;

      // Hardware inverse check (ANSI reverse video)
      let hasInverseCell = false;
      const cols = line.length;
      for (let c = 0; c < Math.min(cols, 60); c++) {
        const cell = line.getCell(c);
        if (cell && cell.isInverse()) {
          hasInverseCell = true;
          break;
        }
      }

      if (hasInverseCell) {
        targetAbsRow = absRow;
        break;
      }

      // Check all modern CLI pointer glyphs: ❯, ›, >, ➜, ●, etc.
      const pointerRegex = new RegExp(`^${POINTER_CHARS}\\s*(\\/[a-zA-Z0-9_\\-]+|\\[\\d+\\]|\\d+[\\.\\)]|[a-zA-Z0-9_\\-]+|\\([•\\*xX\\s]\\))`);
      if (pointerRegex.test(str) || /^\[[\*xX]\]/.test(str) || /^\([•\*xX]\)/.test(str)) {
        targetAbsRow = absRow;
      }
    }

    // Fallback: If no explicit menu pointer, check hardware cursor line
    if (targetAbsRow === -1 && cursorAbs < totalLines) {
      const curLine = buf.getLine(cursorAbs);
      if (curLine) {
        const curStr = curLine.translateToString(true).trim();
        if (curStr && !/[@\w\.\-]+:[~\w\/\.\-]+[\$#>]\s*$/.test(curStr)) {
          targetAbsRow = cursorAbs;
        }
      }
    }

    if (targetAbsRow === -1) return null;

    // 2. Dynamic Option Aggregator: Collect the option header + ALL subsequent explanation lines
    const firstLine = buf.getLine(targetAbsRow);
    if (!firstLine) return null;

    const blockLines: string[] = [firstLine.translateToString(true).trim()];

    let scanR = targetAbsRow + 1;
    while (scanR < totalLines) {
      const nextLine = buf.getLine(scanR);
      if (!nextLine) break;

      const nextStr = nextLine.translateToString(true).trim();
      if (!nextStr) break;

      if (isOptionStart(nextStr)) {
        break;
      }

      if (/[@\w\.\-]+:[~\w\/\.\-]+[\$#>]\s*$/.test(nextStr) || /^[─━=\-_#~]{3,}$/.test(nextStr)) {
        break;
      }

      const cleanedPart = nextStr.replace(/^[│┃|]\s?/, '').replace(/\s?[│┃|]$/, '').trim();
      if (cleanedPart) {
        blockLines.push(cleanedPart);
      }

      scanR++;
      if (scanR - targetAbsRow > 10) break;
    }

    const fullBlockText = blockLines.join(' ').replace(/\s+/g, ' ').trim();
    // Strip ALL pointers thoroughly!
    const cleanHeader = fullBlockText.replace(new RegExp(`^${POINTER_CHARS}+\\s*`), '').trim();
    if (!cleanHeader || cleanHeader.length <= 1) return null;

    // 3. Match against rich dictionary first (0ms instant hit)
    const dictHit: DictEntry | null = lookupRichDict(cleanHeader);
    if (dictHit) {
      return {
        raw: fullBlockText,
        badge: dictHit.badge,
        command: dictHit.title,
        explanation: dictHit.explanation,
        instant: true,
      };
    }

    // 4. Dynamic Structure Parsing for Non-Cached Submenus:
    // Format A: Slash Command
    const slashMatch = cleanHeader.match(/^(\/[a-zA-Z0-9_\-]+)\s*(?:[-–—:]\s*)?(.*)$/);
    if (slashMatch) {
      return {
        raw: fullBlockText,
        badge: '【命令选项】',
        command: slashMatch[1],
        explanation: slashMatch[2].trim() || slashMatch[1],
        instant: false,
      };
    }

    // Format B: Numbered / Lettered Option
    const optionMatch = cleanHeader.match(/^((?:\[\d+\]|\d+[\.\)]|[a-zA-Z][\.\)]|\([•\*xX\s]\)))\s*(?:[-–—:]\s*)?(.*)$/);
    if (optionMatch) {
      const numBadge = `【选项 ${optionMatch[1].replace(/[\.\)\[\]\(\)]/g, '').trim()}】`;
      return {
        raw: fullBlockText,
        badge: numBadge,
        command: optionMatch[1],
        explanation: optionMatch[2].trim() || cleanHeader,
        instant: false,
      };
    }

    // Format C: General interactive prompt / Question
    return {
      raw: fullBlockText,
      badge: '【当前选项】',
      command: '',
      explanation: cleanHeader,
      instant: false,
    };
  } catch {
    return null;
  }
}
