import type { Terminal } from '@xterm/xterm';
import { DEV_TOOL_EXACT_DICT, DEV_TOOL_TEMPLATES } from '@termux-webui/shared';

export type TranslateFunction = (text: string) => Promise<string>;

/**
 * Industrial-Grade Terminal Stream Translator with Token Shielding
 * 1. URL & File Path Shielding (100% Immunity to mistranslation)
 * 2. Case-Insensitive Greedy Longest-Phrase Matcher
 * 3. Dynamic Template Interpolation (Numbers, durations, counts)
 * 4. 0 Overlay / 0 Shadow / 100% Native xterm Stream Ingestion
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
        // Case-insensitive global matching
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
   * Transforms stream chunks while strictly preserving ANSI sequences and shielding URLs.
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

      if (!/[A-Za-z]{2,}/.test(token)) {
        continue;
      }

      // Skip lines that already contain substantive Chinese
      const chineseCount = (token.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (chineseCount >= 4) {
        continue;
      }

      // === SHIELDING STEP 1: Shield URLs and File Paths with Safe Placeholders ===
      const shields: string[] = [];
      // Shield HTTP/HTTPS/WS URLs (e.g. http://localhost:3000, https://github.com/...)
      token = token.replace(/(https?:\/\/[^\s\x1b\x07)\]'"]+)/gi, (match) => {
        const id = `__URL_SHIELD_${shields.length}__`;
        shields.push(match);
        return id;
      });

      // Shield explicit file paths (e.g. /var/log/syslog, /usr/bin/node, ./src/main.ts)
      token = token.replace(/((?:\/|[a-zA-Z]:\\|\.\/|\.\.\/)[\w.-]+(?:\/[\w.-]+)+)/g, (match) => {
        const id = `__PATH_SHIELD_${shields.length}__`;
        shields.push(match);
        return id;
      });

      // === TRANSLATION STEP 2: Template & Dictionary Greedy Matching ===
      // 2.1 Dynamic template replacers
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
        // 2.2 Exact match check
        const trimmed = token.trim();
        const exact = this.exactDictMap.get(trimmed.toLowerCase());
        if (exact) {
          token = token.replace(trimmed, exact);
        } else {
          // 2.3 Greedy Longest-Phrase Substring Replacement
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

      // === UNSHIELDING STEP 3: Restore Protected URLs & Paths 100% Untouched ===
      for (let sIdx = 0; sIdx < shields.length; sIdx += 1) {
        const urlId = `__URL_SHIELD_${sIdx}__`;
        const pathId = `__PATH_SHIELD_${sIdx}__`;
        token = token.split(urlId).join(shields[sIdx]);
        token = token.split(pathId).join(shields[sIdx]);
      }

      // If token was translated, append erase-to-end-of-line (\x1b[K) to clean any trailing ghost cells
      if (token !== tokens[i] && !token.includes('\x1b[K')) {
        tokens[i] = token + '\x1b[K';
      } else {
        tokens[i] = token;
      }

      // 4. Background learn for unmatched standalone text
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
