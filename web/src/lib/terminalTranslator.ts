import type { Terminal } from '@xterm/xterm';
import { DEV_TOOL_EXACT_DICT, DEV_TOOL_TEMPLATES } from '@termux-webui/shared';

export type TranslateFunction = (text: string) => Promise<string>;

/**
 * Ultra-Responsive Zero-Latency Stream Terminal Translator
 * 1. 0 Overlays, 100% Native Single-Layer Rendering
 * 2. Instant In-Stream ANSI-Safe Longest-Phrase Replacement
 * 3. Slash-Command & Option Menu Friendly
 * 4. 0-Latency Local Dictionary & Persistent Learned Cache
 */
export class TerminalTranslator {
  private term: Terminal;
  private translateFn: TranslateFunction;
  private exactDictMap = new Map<string, string>();
  private sortedPhrases: Array<{ pattern: RegExp; rawLen: number; target: string }> = [];
  private isEnabled = true;

  constructor(term: Terminal, translateFn: TranslateFunction) {
    this.term = term;
    this.translateFn = translateFn;

    this.rebuildPhraseIndex(DEV_TOOL_EXACT_DICT);
    void this.fetchRemoteAndLearnedDicts();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public clear(): void {
    this.rebuildPhraseIndex(DEV_TOOL_EXACT_DICT);
  }

  /**
   * Rebuilds the search index with longest-phrase-first ordering for greedy matching.
   */
  private rebuildPhraseIndex(dict: Record<string, string>): void {
    this.exactDictMap.clear();
    const list: Array<{ raw: string; rawLen: number; target: string }> = [];

    for (const [k, v] of Object.entries(dict)) {
      const trimmed = k.trim();
      if (trimmed.length < 2) continue;
      this.exactDictMap.set(trimmed.toLowerCase(), v);
      list.push({
        raw: trimmed,
        rawLen: trimmed.length,
        target: v,
      });
    }

    // Sort descending by phrase length so longer matches take precedence
    list.sort((a, b) => b.rawLen - a.rawLen);

    this.sortedPhrases = list.map((item) => {
      const escaped = item.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return {
        pattern: new RegExp(escaped, 'gi'),
        rawLen: item.rawLen,
        target: item.target,
      };
    });
  }

  /**
   * Pre-fetches official dictionary and learned dictionary from backend.
   */
  private async fetchRemoteAndLearnedDicts(): Promise<void> {
    try {
      const res = await fetch('/api/dictionary');
      if (res.ok) {
        const data = (await res.json()) as { entries?: Record<string, string> };
        if (data && data.entries) {
          const merged = { ...DEV_TOOL_EXACT_DICT, ...data.entries };
          this.rebuildPhraseIndex(merged);
        }
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Ingests raw PTY chunk before xterm Buffer.
   * Performs instant 0ms transformation and writes directly to terminal.write().
   */
  public ingest(rawChunk: string): void {
    if (!this.isEnabled) {
      this.term.write(rawChunk);
      return;
    }

    try {
      const transformed = this.transformStream(rawChunk);
      this.term.write(transformed);
    } catch {
      // Graceful fallback: never crash terminal
      this.term.write(rawChunk);
    }
  }

  /**
   * Transforms stream chunks while strictly preserving ANSI sequences.
   */
  private transformStream(chunk: string): string {
    if (!/[A-Za-z]{2,}/.test(chunk)) {
      return chunk;
    }

    // Tokenize chunk into ANSI escape sequences vs visible text
    // eslint-disable-next-line no-control-regex
    const tokens = chunk.split(/(\x1b\[[0-9;]*[a-zA-Z]|\x1b\([a-zA-Z]|\x1b\][^\x07\x1b]*\x07)/g);

    for (let i = 0; i < tokens.length; i += 1) {
      let token = tokens[i];
      // Skip empty or ANSI control sequences
      if (!token || token.startsWith('\x1b')) {
        continue;
      }

      // Check if token contains English letters
      if (!/[A-Za-z]{2,}/.test(token)) {
        continue;
      }

      // Skip lines that are already Chinese
      const chineseCount = (token.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (chineseCount >= 4) {
        continue;
      }

      // 1. Dynamic template replacers (Numbers, elapsed times, vulnerabilities)
      let templateMatched = false;
      for (const tpl of DEV_TOOL_TEMPLATES) {
        if (tpl.pattern.test(token)) {
          token = token.replace(
            tpl.pattern,
            tpl.replace as (substring: string, ...args: unknown[]) => string,
          );
          templateMatched = true;
        }
      }
      if (templateMatched) {
        tokens[i] = token;
        continue;
      }

      // 2. Exact match check
      const trimmed = token.trim();
      const exact = this.exactDictMap.get(trimmed.toLowerCase());
      if (exact) {
        tokens[i] = token.replace(trimmed, exact);
        continue;
      }

      // 3. Greedy Longest-Phrase Substring Replacement
      let modified = token;
      for (const phrase of this.sortedPhrases) {
        if (phrase.pattern.test(modified)) {
          modified = modified.replace(phrase.pattern, phrase.target);
          phrase.pattern.lastIndex = 0;
        }
      }
      tokens[i] = modified;

      // 4. Trigger async background machine translation for unknown standalone sentences
      if (
        modified === token &&
        trimmed.length >= 4 &&
        trimmed.length <= 120 &&
        !trimmed.startsWith('http') &&
        !trimmed.startsWith('--') &&
        !/^[0-9a-f]{7,40}$/i.test(trimmed)
      ) {
        void this.asyncTranslateAndLearn(trimmed);
      }
    }

    return tokens.join('');
  }

  private async asyncTranslateAndLearn(text: string): Promise<void> {
    const key = text.toLowerCase();
    if (this.exactDictMap.has(key)) return;

    try {
      const translated = await this.translateFn(text);
      if (translated && translated !== text) {
        this.exactDictMap.set(key, translated);
        const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        this.sortedPhrases.unshift({
          pattern: new RegExp(escaped, 'gi'),
          rawLen: text.length,
          target: translated,
        });
      }
    } catch {
      /* ignore */
    }
  }
}
