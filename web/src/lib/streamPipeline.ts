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
 * Terminal Stream Pipeline & Anchor Generator
 * Analyzes terminal output stream in parallel without touching or mutating original raw bytes.
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

  public feed(): void {
    if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.extractAndTranslateAnchors();
    }, 120);
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
   * Scans visible active buffer rows to generate precise TranslationAnchors.
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
      // Never place visual overlay directly on top of active typing cursor row
      if (row === cursorAbsRow) continue;

      const line = buf.getLine(row);
      if (!line) continue;
      const rawStr = line.translateToString(true);
      const trimmed = rawStr.trim();

      // Check if line is eligible for translation
      if (!this.isValidTranslatableLine(trimmed)) continue;

      const leadingSpaces = rawStr.match(/^\s*/)?.[0]?.length || 0;
      const startCol = leadingSpaces;
      const endCol = startCol + trimmed.length;

      const id = `${row}:${startCol}:${trimmed}`;
      activeKeys.add(id);

      const existing = this.anchors.get(id);
      if (!existing) {
        pendingItems.push({
          id,
          bufferRow: row,
          startCol,
          endCol,
          text: trimmed,
        });
      }
    }

    // Garbage Collection: remove anchors that were deleted, cleared, or scrolled out
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

    // Concurrently fetch translations
    await Promise.all(
      pendingItems.map(async (item) => {
        try {
          const translated = await this.translateFn(item.text);
          if (
            curGen !== this.generation ||
            !translated ||
            translated === item.text ||
            !translated.trim()
          ) {
            return;
          }

          const anchor: TranslationAnchor = {
            id: item.id,
            bufferRow: item.bufferRow,
            startCol: item.startCol,
            endCol: item.endCol,
            originalText: item.text,
            translatedText: translated.trim(),
            timestamp: Date.now(),
          };

          this.anchors.set(item.id, anchor);
          this.onAnchorsChange(Array.from(this.anchors.values()));
        } catch {
          /* ignore fetch failure */
        }
      }),
    );
  }

  private isValidTranslatableLine(text: string): boolean {
    if (!text || text.length < 2 || text.length > 500) return false;

    // Skip pure shell prompts if they don't contain substantive text
    if (/^[\w.-]+@[\w.-]+[:#$~>\s]*$/.test(text)) return false;
    if (/^[#$%>›❯]\s*$/.test(text)) return false;

    // Skip pure symbol decoration lines (box drawings, delimiters)
    if (/^[╭╮╰╯│─┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬\s\-_+=*#|/\\]+$/.test(text)) {
      return false;
    }

    // Must contain at least one English word (2+ letters)
    return /[A-Za-z]{2,}/.test(text);
  }
}
