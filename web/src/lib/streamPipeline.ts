import type { Terminal } from '@xterm/xterm';

export interface TranslationAnchor {
  id: string;
  bufferRow: number;
  startCol: number;
  endCol: number;
  originalText: string;
  translatedText: string;
  timestamp: number;
}

export type TranslateFunction = (text: string) => Promise<string>;

/**
 * Fine-Grained Inline Span Terminal Stream Pipeline
 * Only extracts and replaces natural language English spans.
 * All command names, prefixes (❯, ●, >), and symbols remain 100% raw and unmasked.
 */
export class TerminalStreamPipeline {
  private term: Terminal;
  private translateFn: TranslateFunction;
  private anchors = new Map<string, TranslationAnchor>();
  private onAnchorsChange: (anchors: TranslationAnchor[]) => void;
  private debounceTimer: number | null = null;
  private generation = 0;

  constructor(
    term: Terminal,
    translateFn: TranslateFunction,
    onAnchorsChange: (anchors: TranslationAnchor[]) => void,
  ) {
    this.term = term;
    this.translateFn = translateFn;
    this.onAnchorsChange = onAnchorsChange;
  }

  /** Called when new PTY output arrives */
  public feed(): void {
    if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.extractAndTranslateAnchors();
    }, 30);
  }

  /** Called immediately when user presses a key */
  public onUserInput(): void {
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    void this.extractAndTranslateAnchors();
  }

  public clear(): void {
    this.generation += 1;
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.anchors.clear();
    this.onAnchorsChange([]);
  }

  public refresh(): void {
    void this.extractAndTranslateAnchors();
  }

  /**
   * Scans visible active buffer rows to extract precise inline English spans.
   */
  private async extractAndTranslateAnchors(): Promise<void> {
    const curGen = this.generation;
    const buf = this.term.buffer.active;
    const viewportY = buf.viewportY;
    const rows = this.term.rows;
    const cursorAbsRow = buf.cursorY + buf.baseY;

    const start = Math.max(0, viewportY);
    const end = Math.min(buf.length, viewportY + rows);

    const activeKeys = new Set<string>();
    const pendingItems: Array<{
      id: string;
      bufferRow: number;
      startCol: number;
      endCol: number;
      text: string;
    }> = [];

    for (let row = start; row < end; row += 1) {
      // 100% strictly protect the active typing cursor row
      if (row === cursorAbsRow) {
        continue;
      }

      const line = buf.getLine(row);
      if (!line) continue;
      const rawStr = line.translateToString(true);
      if (!rawStr || rawStr.trim().length < 3) continue;

      // 1. Native Chinese Protection: If line already contains substantive Chinese, NEVER mask it
      const chineseCharCount = (rawStr.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (chineseCharCount >= 3 || (chineseCharCount > 0 && chineseCharCount / rawStr.trim().length > 0.2)) {
        continue;
      }

      // 2. Extract precise inline English natural language span
      const spanInfo = this.extractTranslatableSpan(rawStr);
      if (!spanInfo) continue;

      const { spanText, startCol, endCol } = spanInfo;
      const id = `${row}:${startCol}:${spanText}`;
      activeKeys.add(id);

      const existing = this.anchors.get(id);
      if (!existing) {
        pendingItems.push({
          id,
          bufferRow: row,
          startCol,
          endCol,
          text: spanText,
        });
      }
    }

    // Garbage Collection
    let changed = false;
    for (const id of Array.from(this.anchors.keys())) {
      if (!activeKeys.has(id)) {
        this.anchors.delete(id);
        changed = true;
      }
    }

    if (changed) {
      this.onAnchorsChange(Array.from(this.anchors.values()));
    }

    if (pendingItems.length === 0) return;

    // Batch translate pending items
    await Promise.all(
      pendingItems.map(async (item) => {
        try {
          const translated = await this.translateFn(item.text);
          if (curGen !== this.generation) return;
          if (translated && translated !== item.text) {
            this.anchors.set(item.id, {
              id: item.id,
              bufferRow: item.bufferRow,
              startCol: item.startCol,
              endCol: item.endCol,
              originalText: item.text,
              translatedText: translated,
              timestamp: Date.now(),
            });
            this.onAnchorsChange(Array.from(this.anchors.values()));
          }
        } catch {
          /* ignore individual translation failures */
        }
      }),
    );
  }

  /**
   * Identifies the precise inline natural language span within a terminal line.
   * Keeps command names, prefixes, and options completely untouched.
   */
  private extractTranslatableSpan(rawStr: string): { spanText: string; startCol: number; endCol: number } | null {
    // Skip box drawings and horizontal delimiters
    if (/^[╭╮╰╯│─┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬\s\-_+=*#|/\\]+$/.test(rawStr.trim())) {
      return false as unknown as null;
    }

    // Skip pure shell prompts
    if (/^[\w.-]+@[\w.-]+[:#$~>\s]*$/.test(rawStr.trim())) return null;

    // Pattern A: Menu items with command on left and description on right
    // e.g. "  /plan          switch to Plan mode"
    // e.g. "  /goal          set or view the goal"
    const menuMatch = rawStr.match(/^(\s*(?:[❯>●*✔✓]|\[[ x*]\]|\([ x*]\))?\s*(?:\/[\w-]+|[0-9]+\.\s*[\w.-]+)\s{2,})([A-Za-z].+)$/);
    if (menuMatch) {
      const prefix = menuMatch[1];
      const span = menuMatch[2].trimEnd();
      const startCol = prefix.length;
      return {
        spanText: span,
        startCol,
        endCol: startCol + span.length,
      };
    }

    // Pattern B: Option items with parenthesized description
    // e.g. "❯ 1. React (A JavaScript library for building user interfaces)"
    // e.g. "  2. Vue.js (The Progressive JavaScript Framework)"
    const parenMatch = rawStr.match(/^(\s*(?:[❯>●*✔✓]|\[[ x*]\]|\([ x*]\))?\s*.*?\()([A-Za-z][^)]+)(\).*)$/);
    if (parenMatch && parenMatch[2].length >= 4) {
      const prefix = parenMatch[1];
      const span = parenMatch[2];
      const startCol = prefix.length;
      return {
        spanText: span,
        startCol,
        endCol: startCol + span.length,
      };
    }

    // Pattern C: Standard full-sentence messages (Errors, Tips, Prompts)
    // e.g. "? Please select your preferred framework:"
    // e.g. "Permission denied (publickey, gssapi-keyex)"
    // e.g. "Tip: New Build faster with Codex."
    const trimmed = rawStr.trim();
    if (/[A-Za-z]{2,}/.test(trimmed)) {
      const leadingSpaces = rawStr.match(/^\s*/)?.[0]?.length || 0;
      return {
        spanText: trimmed,
        startCol: leadingSpaces,
        endCol: leadingSpaces + trimmed.length,
      };
    }

    return null;
  }
}
