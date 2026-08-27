import type { Terminal } from '@xterm/xterm';

export type TranslateFn = (text: string, toLang?: string) => Promise<string>;

/**
 * Chromium Google-Translate-Style In-DOM Terminal Translator
 * Directly translates .xterm-rows text nodes without causing layout jumps or flicker.
 */
export class ChromeStyleDOMTranslator {
  private term: Terminal;
  private host: HTMLElement;
  private translateFn: TranslateFn;
  private active = false;
  private disposables: { dispose: () => void }[] = [];
  private debounceTimer: number | null = null;
  private lineCache = new Map<string, string>(); // English -> Chinese cache
  private originalCursorBlink = true;

  constructor(term: Terminal, host: HTMLElement, translateFn: TranslateFn) {
    this.term = term;
    this.host = host;
    this.translateFn = translateFn;
  }

  public enable(): void {
    if (this.active) return;
    this.active = true;

    // 1. Freeze xterm cursor blinking to eliminate background repaint loop
    this.originalCursorBlink = this.term.options.cursorBlink ?? true;
    this.term.options.cursorBlink = false;

    // 2. Perform initial translation pass on visible rows
    void this.translateVisibleDOMRows();

    // 3. Listen to scroll events with a 300ms idle debounce (Google Translate style)
    const dScroll = this.term.onScroll(() => this.scheduleTranslate(300));
    const dLineFeed = this.term.onLineFeed(() => this.scheduleTranslate(400));
    this.disposables.push(dScroll, dLineFeed);
  }

  public disable(): void {
    if (!this.active) return;
    this.active = false;

    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Restore cursor blink preference
    this.term.options.cursorBlink = this.originalCursorBlink;

    // Force xterm to repaint clean original English text instantly
    this.term.refresh(0, Math.max(0, this.term.rows - 1));
  }

  public isActive(): boolean {
    return this.active;
  }

  private scheduleTranslate(delayMs = 300): void {
    if (!this.active) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      void this.translateVisibleDOMRows();
    }, delayMs);
  }

  /**
   * Google-Translate-Style Safe TextNode Mutation:
   * Extracts the full semantic line, translates it, and replaces text in-place using inline font wrappers.
   */
  public async translateVisibleDOMRows(): Promise<void> {
    if (!this.active) return;

    const rowContainer = this.host.querySelector('.xterm-rows');
    if (!rowContainer) return;

    const rowDivs = Array.from(rowContainer.children) as HTMLElement[];
    const rowsToFetch: { rowDiv: HTMLElement; fullText: string; trimmed: string }[] = [];

    for (const rowDiv of rowDivs) {
      // Extract entire text across all spans in this row
      const fullText = rowDiv.textContent || '';
      const trimmed = fullText.trim();

      if (!trimmed) continue;

      // If already translated for this exact source text, skip
      if (rowDiv.getAttribute('data-gtrans-src') === trimmed) {
        continue;
      }

      // Check cache first (0ms instant sync replacement)
      const cached = this.lineCache.get(trimmed);
      if (cached) {
        this.safeReplaceRowText(rowDiv, fullText, cached);
        continue;
      }

      rowsToFetch.push({ rowDiv, fullText, trimmed });
    }

    if (rowsToFetch.length === 0) return;

    // Batch translate all dirty rows concurrently
    const promises = rowsToFetch.map(async (item) => {
      try {
        const translated = await this.translateFn(item.trimmed);
        this.lineCache.set(item.trimmed, translated);
        return { item, translated };
      } catch {
        return { item, translated: item.trimmed };
      }
    });

    const results = await Promise.all(promises);

    if (!this.active) return;

    // Apply translations using safe inline replacement
    for (const res of results) {
      if (res.translated && res.translated !== res.item.trimmed) {
        this.safeReplaceRowText(res.item.rowDiv, res.item.fullText, res.translated);
      }
    }
  }

  /**
   * Safe Inline Replacement (Google Translate <font> pattern):
   * Replaces the row text while preserving exact layout and color.
   */
  private safeReplaceRowText(rowDiv: HTMLElement, originalFullText: string, translatedText: string): void {
    const trimmed = originalFullText.trim();
    const leadingSpaces = originalFullText.match(/^\s*/)?.[0] || '';
    const targetText = leadingSpaces + translatedText;

    rowDiv.setAttribute('data-gtrans-src', trimmed);

    // Google Translate pattern: wrap in inline font tag to maintain exact inline-block flow
    const spans = Array.from(rowDiv.querySelectorAll('span')) as HTMLElement[];
    if (spans.length > 0) {
      spans[0].innerHTML = `<font style="vertical-align: inherit;"><font style="vertical-align: inherit;">${this.escapeHtml(targetText)}</font></font>`;
      for (let i = 1; i < spans.length; i++) {
        spans[i].innerHTML = '';
      }
    } else {
      rowDiv.innerHTML = `<font style="vertical-align: inherit;"><font style="vertical-align: inherit;">${this.escapeHtml(targetText)}</font></font>`;
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
