import type { Terminal } from '@xterm/xterm';
import { DEV_TOOL_EXACT_DICT, DEV_TOOL_TEMPLATES } from '@termux-webui/shared';

export type TranslateFunction = (text: string) => Promise<string>;

/**
 * Clean & Ghost-Free Stream Terminal Translator
 * 1. 0 Token Fragmentation: Strictly preserves natural stream flow
 * 2. 0 Internal \x1b[K Pollution: Eliminates flicker and trailing ghost artifacts
 * 3. URL & Path Shielding (100% immune to link mistranslation)
 * 4. Fast Microsecond Greedy Phrase Replacement
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
   * Rebuilds search index sorted by phrase length descending for longest-match-first.
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
      this.term.write(rawChunk);
    }
  }

  /**
   * Transforms stream chunk safely without breaking ANSI codes or injecting internal erase artifacts.
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
      if (!token || token.startsWith('\x1b')) {
        continue;
      }

      if (!/[A-Za-z]{2,}/.test(token)) {
        continue;
      }

      // Skip lines that already contain substantive Chinese
      const chineseCount = (token.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (chineseCount >= 4) {
        continue;
      }

      // === SHIELDING STEP 1: Shield URLs and File Paths ===
      const shields: string[] = [];
      token = token.replace(/(https?:\/\/[^\s\x1b\x07)\]'"]+)/gi, (match) => {
        const id = `__URL_SHIELD_${shields.length}__`;
        shields.push(match);
        return id;
      });

      token = token.replace(/((?:\/|[a-zA-Z]:\\|\.\/|\.\.\/)[\w.-]+(?:\/[\w.-]+)+)/g, (match) => {
        const id = `__PATH_SHIELD_${shields.length}__`;
        shields.push(match);
        return id;
      });

      // === TRANSLATION STEP 2: Template & Greedy Matching ===
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

      if (!templateMatched) {
        const trimmed = token.trim();
        const exact = this.exactDictMap.get(trimmed.toLowerCase());
        if (exact) {
          token = token.replace(trimmed, exact);
        } else {
          let modified = token;
          for (const phrase of this.sortedPhrases) {
            if (phrase.pattern.test(modified)) {
              modified = modified.replace(phrase.pattern, phrase.target);
              phrase.pattern.lastIndex = 0;
            }
          }
          token = modified;
        }
      }

      // === UNSHIELDING STEP 3: Restore URLs & Paths ===
      for (let sIdx = 0; sIdx < shields.length; sIdx += 1) {
        const urlId = `__URL_SHIELD_${sIdx}__`;
        const pathId = `__PATH_SHIELD_${sIdx}__`;
        token = token.split(urlId).join(shields[sIdx]);
        token = token.split(pathId).join(shields[sIdx]);
      }

      // Pure clean assignment - NO internal \x1b[K injection that destroys trailing tokens
      tokens[i] = token;

      // Background learn for unmatched text
      const finalTrimmed = token.trim();
      if (
        shields.length === 0 &&
        finalTrimmed.length >= 4 &&
        finalTrimmed.length <= 100 &&
        !finalTrimmed.startsWith('--') &&
        !/^[0-9a-f]{7,40}$/i.test(finalTrimmed)
      ) {
        void this.asyncTranslateAndLearn(finalTrimmed);
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
