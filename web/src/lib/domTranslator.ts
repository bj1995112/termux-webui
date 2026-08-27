import type { Terminal } from '@xterm/xterm';

export type TranslateFn = (text: string, toLang?: string) => Promise<string>;

export class ChromeStyleDOMTranslator {
  private term: Terminal;
  private host: HTMLElement;
  private translateFn: TranslateFn;
  private active = false;
  private disposables: { dispose: () => void }[] = [];
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private isMutating = false; // Prevent infinite mutation loops
  private lineCache = new Map<string, string>(); // English -> Chinese cache

  constructor(term: Terminal, host: HTMLElement, translateFn: TranslateFn) {
    this.term = term;
    this.host = host;
    this.translateFn = translateFn;
  }

  public enable(): void {
    if (this.active) return;
    this.active = true;

    // 1. Initial translation of visible rows
    void this.translateDOMRows();

    // 2. Listen to xterm render & scroll events
    const d1 = this.term.onRender(() => this.scheduleTranslate());
    const d2 = this.term.onScroll(() => this.scheduleTranslate());
    const d3 = this.term.onLineFeed(() => this.scheduleTranslate());
    this.disposables.push(d1, d2, d3);

    // 3. MutationObserver on .xterm-rows to immediately catch xterm DOM repaints
    const rowContainer = this.host.querySelector('.xterm-rows');
    if (rowContainer) {
      this.observer = new MutationObserver((mutations) => {
        if (this.isMutating || !this.active) return;
        let needsUpdate = false;
        for (const m of mutations) {
          if (m.type === 'childList' || m.type === 'characterData') {
            needsUpdate = true;
            break;
          }
        }
        if (needsUpdate) {
          this.scheduleTranslate();
        }
      });

      this.observer.observe(rowContainer, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  public disable(): void {
    if (!this.active) return;
    this.active = false;

    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Force clean original English re-render
    this.term.refresh(0, Math.max(0, this.term.rows - 1));
  }

  public isActive(): boolean {
    return this.active;
  }

  private scheduleTranslate(): void {
    if (!this.active) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      void this.translateDOMRows();
    }, 80); // Ultra-fast 80ms debounce
  }

  /** Directly scan and translate .xterm-rows > div > span nodes */
  public async translateDOMRows(): Promise<void> {
    if (!this.active || this.isMutating) return;

    const rowContainer = this.host.querySelector('.xterm-rows');
    if (!rowContainer) return;

    const rowDivs = Array.from(rowContainer.children) as HTMLElement[];
    const rowsToFetch: { el: HTMLElement; spans: HTMLElement[]; rawText: string; trimmed: string }[] = [];

    for (const rowDiv of rowDivs) {
      // Collect text from all child spans
      const spans = Array.from(rowDiv.querySelectorAll('span')) as HTMLElement[];
      const fullText = spans.map((s) => s.textContent || '').join('');
      const trimmed = fullText.trim();

      if (!trimmed) continue;

      // Avoid re-translating if already translated with same source
      if (rowDiv.getAttribute('data-translated-src') === trimmed) {
        continue;
      }

      // Check cache first (0ms instant sync replacement)
      const cached = this.lineCache.get(trimmed);
      if (cached) {
        this.applyTranslationToRow(rowDiv, spans, fullText, cached);
        continue;
      }

      rowsToFetch.push({ el: rowDiv, spans, rawText: fullText, trimmed });
    }

    if (rowsToFetch.length === 0) return;

    // Fetch missing translations concurrently
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

    this.isMutating = true;
    try {
      for (const res of results) {
        if (res.translated && res.translated !== res.item.trimmed) {
          this.applyTranslationToRow(res.item.el, res.item.spans, res.item.rawText, res.translated);
        }
      }
    } finally {
      // Re-enable mutation listening after short microtask
      setTimeout(() => {
        this.isMutating = false;
      }, 30);
    }
  }

  /** Apply translated Chinese text directly into xterm DOM spans */
  private applyTranslationToRow(
    rowDiv: HTMLElement,
    spans: HTMLElement[],
    originalFullText: string,
    translatedText: string,
  ): void {
    const leadingSpaces = originalFullText.match(/^\s*/)?.[0] || '';
    const targetText = leadingSpaces + translatedText;

    rowDiv.setAttribute('data-translated-src', originalFullText.trim());

    if (spans.length > 0) {
      // Put full translated string into first span, empty remaining spans to keep layout clean
      spans[0].textContent = targetText;
      for (let i = 1; i < spans.length; i++) {
        spans[i].textContent = '';
      }
    } else {
      rowDiv.textContent = targetText;
    }
  }
}
