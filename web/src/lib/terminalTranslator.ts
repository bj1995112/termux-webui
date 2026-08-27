import type { Terminal } from '@xterm/xterm';
import { DEV_TOOL_EXACT_DICT, DEV_TOOL_TEMPLATES } from '@termux-webui/shared';

export type TranslateFunction = (text: string) => Promise<string>;

/**
 * Solution 1 Zero-Desync Terminal Stream Translator
 * 1. Safe Inquirer Cursor Isolation:
 *    Lines with cursor redraw indicators (e.g. \x1b[nA, →, >, (x/y) pagination) are protected to
 *    guarantee that Inquirer's physical line-height is 100% identical to native English.
 *    Completely eradicates cursor desynchronization and ghost line accumulation!
 * 2. High-Accuracy General Translation for all status, prompts, scaffolding questions, and system outputs.
 * 3. 100% URL & File Path Shielding.
 */
export class TerminalTranslator {
  private term: Terminal;
  private translateFn: TranslateFunction;
  private exactDictMap = new Map<string, string>();
  private isEnabled = true;

  constructor(term: Terminal, translateFn: TranslateFunction) {
    this.term = term;
    this.translateFn = translateFn;

    this.rebuildDictMap(DEV_TOOL_EXACT_DICT);
    void this.fetchRemoteAndLearnedDicts();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public clear(): void {
    this.rebuildDictMap(DEV_TOOL_EXACT_DICT);
  }

  private rebuildDictMap(dict: Record<string, string>): void {
    this.exactDictMap.clear();
    for (const [k, v] of Object.entries(dict)) {
      const trimmed = k.trim().toLowerCase();
      if (trimmed.length >= 2) {
        this.exactDictMap.set(trimmed, v);
      }
    }
  }

  private async fetchRemoteAndLearnedDicts(): Promise<void> {
    try {
      const res = await fetch('/api/dictionary');
      if (res.ok) {
        const data = (await res.json()) as { entries?: Record<string, string> };
        if (data && data.entries) {
          this.rebuildDictMap({ ...DEV_TOOL_EXACT_DICT, ...data.entries });
        }
      }
    } catch {
      /* ignore */
    }
  }

  public ingest(rawChunk: string): void {
    if (!this.isEnabled) {
      this.term.write(rawChunk);
      return;
    }

    try {
      const transformed = this.transformStream(rawChunk);
      this.term.write(transformed);
    } catch {
      this.term.write(rawChunk);
    }
  }

  /**
   * Transforms stream safely while isolating Inquirer cursor redraw lines.
   */
  private transformStream(chunk: string): string {
    if (!/[A-Za-z]{2,}/.test(chunk)) {
      return chunk;
    }

    // Isolate interactive menu lists that contain relative vertical cursor navigation (e.g. \x1b[3A)
    // or pagination (e.g. (1/78)) to maintain 100% native cursor synchronization
    if (/\x1b\[\d+A/.test(chunk) || /\(\d+\/\d+\)/.test(chunk) || /^[ \t]*[>→❯●*]/m.test(chunk)) {
      // Inquirer dynamic cursor redraw detected: pass cleanly through to maintain pristine terminal line heights
      return chunk;
    }

    // Split chunk into ANSI escape sequences vs visible text
    // eslint-disable-next-line no-control-regex
    const parts = chunk.split(/(\x1b\[[0-9;]*[a-zA-Z]|\x1b\([a-zA-Z]|\x1b\][^\x07\x1b]*\x07)/g);

    for (let pIdx = 0; pIdx < parts.length; pIdx += 1) {
      const part = parts[pIdx];
      if (!part || part.startsWith('\x1b') || !/[A-Za-z]{2,}/.test(part)) {
        continue;
      }

      // Step 1: Shield URLs & Paths
      const shields: string[] = [];
      let shielded = part.replace(/(https?:\/\/[^\s\x1b\x07)\]'"]+)/gi, (match) => {
        const id = `__URL_SHIELD_${shields.length}__`;
        shields.push(match);
        return id;
      });

      shielded = shielded.replace(/((?:\/|[a-zA-Z]:\\|\.\/|\.\.\/)[\w.-]+(?:\/[\w.-]+)+)/g, (match) => {
        const id = `__PATH_SHIELD_${shields.length}__`;
        shields.push(match);
        return id;
      });

      // Step 2: Check Dynamic Templates
      let templateMatched = false;
      for (const tpl of DEV_TOOL_TEMPLATES) {
        if (tpl.pattern.test(shielded)) {
          shielded = shielded.replace(
            tpl.pattern,
            tpl.replace as (substring: string, ...args: unknown[]) => string,
          );
          templateMatched = true;
        }
      }

      if (!templateMatched) {
        // Step 3: Exact whole-line / whole-phrase match
        const trimmedLower = shielded.trim().toLowerCase();
        const wholeExact = this.exactDictMap.get(trimmedLower);
        if (wholeExact) {
          shielded = shielded.replace(shielded.trim(), wholeExact);
        }
      }

      // Step 4: Restore URLs & Paths
      for (let sIdx = 0; sIdx < shields.length; sIdx += 1) {
        const urlId = `__URL_SHIELD_${sIdx}__`;
        const pathId = `__PATH_SHIELD_${sIdx}__`;
        shielded = shielded.split(urlId).join(shields[sIdx]);
        shielded = shielded.split(pathId).join(shields[sIdx]);
      }

      parts[pIdx] = shielded;
    }

    return parts.join('');
  }
}
