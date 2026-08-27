import type { Terminal } from '@xterm/xterm';

export type TranslateFn = (text: string, toLang?: string) => Promise<string>;

export class TerminalLocalizer {
  private term: Terminal;
  private host: HTMLElement;
  private translateFn: TranslateFn;
  private active = false;
  private disposables: { dispose: () => void }[] = [];
  private debounceTimer: number | null = null;
  private lineCache = new Map<string, string>(); // English -> Chinese cache

  constructor(term: Terminal, host: HTMLElement, translateFn: TranslateFn) {
    this.term = term;
    this.host = host;
    this.translateFn = translateFn;
  }

  public enable(): void {
    if (this.active) return;
    this.active = true;

    // 1. Localize current visible screen immediately
    void this.localizeVisibleRows();

    // 2. Listen to render/scroll/linefeed events to translate new lines automatically
    const d1 = this.term.onRender(() => this.scheduleLocalize());
    const d2 = this.term.onScroll(() => this.scheduleLocalize());
    const d3 = this.term.onLineFeed(() => this.scheduleLocalize());

    this.disposables.push(d1, d2, d3);
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

    // Force xterm to re-render clean original English text
    this.term.refresh(0, Math.max(0, this.term.rows - 1));
  }

  public isActive(): boolean {
    return this.active;
  }

  private scheduleLocalize(): void {
    if (!this.active) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      void this.localizeVisibleRows();
    }, 150); // Fast 150ms debounce
  }

  public async localizeVisibleRows(): Promise<void> {
    if (!this.active) return;

    const rowContainer = this.host.querySelector('.xterm-rows');
    if (!rowContainer) return;

    const rowElements = Array.from(rowContainer.children) as HTMLElement[];
    const buf = this.term.buffer.active;
    const vy = buf.viewportY || 0;

    for (let r = 0; r < rowElements.length && r < this.term.rows; r++) {
      const lineBuf = buf.getLine(vy + r);
      const originalLine = lineBuf ? lineBuf.translateToString(true) : '';
      const trimmed = originalLine.trim();

      if (!trimmed) continue;

      const rowEl = rowElements[r];
      if (!rowEl) continue;

      // Check if already translated to avoid flicker
      if (rowEl.getAttribute('data-translated-src') === trimmed) {
        continue;
      }

      // Check local cache first
      let translated = this.lineCache.get(trimmed);
      if (!translated) {
        try {
          translated = await this.translateFn(trimmed);
          this.lineCache.set(trimmed, translated);
        } catch {
          translated = trimmed;
        }
      }

      if (!this.active) return; // Discard if user toggled off while fetching

      // In-place DOM Replacement
      if (translated && translated !== trimmed) {
        // Preserve leading indentation spaces
        const leading = originalLine.match(/^\s*/)?.[0] || '';
        rowEl.setAttribute('data-translated-src', trimmed);
        rowEl.textContent = leading + translated;
        rowEl.style.color = 'var(--text, #c0caf5)';
        rowEl.style.fontFamily = 'var(--font-mono, monospace)';
      }
    }
  }
}
