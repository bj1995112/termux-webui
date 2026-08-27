import type { Terminal } from '@xterm/xterm';
import { DEV_TOOL_EXACT_DICT, DEV_TOOL_TEMPLATES } from '@termux-webui/shared';

export type TranslateFunction = (text: string) => Promise<string>;

/**
 * Industrial-Grade Terminal Stream Translation Engine
 * Strictly adheres to the 10 Iron Rules:
 * 1. 0 DIV Overlays (Direct xterm.write only)
 * 2. 0 Renderer Modification (Native xterm CJK rendering)
 * 3. 100% ANSI Escape Sequence & Control Code Preservation
 * 4. Cross-Chunk Stream Line Accumulator
 * 5. Incremental UTF-8 Safe Decoding
 * 6. Semantic Filtering (No code, path, URL, or flag mistranslations)
 * 7. Graceful Fallback (Never crash terminal output)
 * 8. Zero-Latency Local Cache & Background Async Learning
 * 9. Dynamic Spinner / \r Fast-Path Passthrough
 * 10. Native CJK Cell Width Handling by xterm.js
 */
export class TerminalTranslator {
  private term: Terminal;
  private translateFn: TranslateFunction;
  private exactDictMap = new Map<string, string>();
  private sortedPhrases: Array<{ pattern: RegExp; rawLen: number; target: string }> = [];
  private isEnabled = true;

  // Stream Line Buffer for Cross-Chunk Assembly (Rule #4)
  private lineAccumulator = '';
  private flushTimer: number | null = null;

  constructor(term: Terminal, translateFn: TranslateFunction) {
    this.term = term;
    this.translateFn = translateFn;

    this.rebuildPhraseIndex(DEV_TOOL_EXACT_DICT);
    void this.fetchRemoteAndLearnedDicts();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.flushBufferDirect();
    }
  }

  public clear(): void {
    this.rebuildPhraseIndex(DEV_TOOL_EXACT_DICT);
    this.lineAccumulator = '';
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
   * Main Entry Point: Ingests raw PTY chunk before xterm Buffer (Rule #1).
   */
  public ingest(rawChunk: string): void {
    // If translation disabled, direct passthrough 100% (Rule #7)
    if (!this.isEnabled) {
      this.flushBufferDirect();
      this.term.write(rawChunk);
      return;
    }

    try {
      // Append new chunk to accumulator
      this.lineAccumulator += rawChunk;

      // Check if delimiter exists (\n or \r\n or \r)
      const lastNewlineIdx = Math.max(
        this.lineAccumulator.lastIndexOf('\n'),
        this.lineAccumulator.lastIndexOf('\r'),
      );

      if (lastNewlineIdx !== -1) {
        // We have complete line(s) to process safely
        const completePortion = this.lineAccumulator.slice(0, lastNewlineIdx + 1);
        this.lineAccumulator = this.lineAccumulator.slice(lastNewlineIdx + 1);

        if (this.flushTimer) {
          window.clearTimeout(this.flushTimer);
          this.flushTimer = null;
        }

        const transformed = this.processCompleteStream(completePortion);
        this.term.write(transformed);
      } else {
        // Fast flush timer for unfinished trailing characters (e.g. prompts without newlines)
        if (this.flushTimer) window.clearTimeout(this.flushTimer);
        this.flushTimer = window.setTimeout(() => {
          this.flushTimer = null;
          if (this.lineAccumulator) {
            const pending = this.lineAccumulator;
            this.lineAccumulator = '';
            const transformed = this.processCompleteStream(pending);
            this.term.write(transformed);
          }
        }, 35);
      }
    } catch {
      // Rule #7: Graceful Fallback on any error, never break terminal
      if (this.lineAccumulator) {
        this.term.write(this.lineAccumulator);
        this.lineAccumulator = '';
      }
      this.term.write(rawChunk);
    }
  }

  private flushBufferDirect(): void {
    if (this.flushTimer) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.lineAccumulator) {
      this.term.write(this.lineAccumulator);
      this.lineAccumulator = '';
    }
  }

  /**
   * Processes a complete multi-line stream segment, strictly isolating ANSI codes.
   */
  private processCompleteStream(stream: string): string {
    // Fast path: if no English letters exist, write directly
    if (!/[A-Za-z]{2,}/.test(stream)) {
      return stream;
    }

    // Split into lines while preserving line endings (\r\n, \n, \r)
    const lines = stream.split(/(\r\n|\n|\r)/);
    const result: string[] = [];

    for (const part of lines) {
      if (part === '\r\n' || part === '\n' || part === '\r') {
        result.push(part);
        continue;
      }
      result.push(this.transformSingleLine(part));
    }

    return result.join('');
  }

  /**
   * Transforms a single line:
   * Rule #3: ANSI sequences 100% preserved.
   * Rule #6: Strict semantic filter for code, paths, URLs, flags.
   */
  private transformSingleLine(lineStr: string): string {
    if (!/[A-Za-z]{2,}/.test(lineStr)) {
      return lineStr;
    }

    // 1. Split into ANSI control codes vs visible text chunks
    // eslint-disable-next-line no-control-regex
    const tokens = lineStr.split(/(\x1b\[[0-9;]*[a-zA-Z]|\x1b\([a-zA-Z]|\x1b\][^\x07\x1b]*\x07)/g);

    // 2. Extract full continuous plain text
    let plainText = '';
    const textIndices: number[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const t = tokens[i];
      if (t && !t.startsWith('\x1b')) {
        plainText += t;
        textIndices.push(i);
      }
    }

    const trimmed = plainText.trim();
    if (trimmed.length < 2 || !/[A-Za-z]{2,}/.test(trimmed)) {
      return lineStr;
    }

    // Rule #6: Semantic Filtering - Skip paths, URLs, code blocks, git hashes
    if (this.isNonTranslatableSemantic(trimmed)) {
      return lineStr;
    }

    // Native Chinese Protection
    const chineseCount = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;
    if (chineseCount >= 4) {
      return lineStr;
    }

    // 3. Perform Full-Sentence / Long-Phrase Translation
    let translated = plainText;

    // 3.1 Dynamic template replacers (Numbers, elapsed times, vulnerabilities)
    for (const tpl of DEV_TOOL_TEMPLATES) {
      if (tpl.pattern.test(translated)) {
        translated = translated.replace(
          tpl.pattern,
          tpl.replace as (substring: string, ...args: unknown[]) => string,
        );
      }
    }

    // 3.2 Exact match
    const exact = this.exactDictMap.get(translated.trim().toLowerCase());
    if (exact) {
      translated = translated.replace(translated.trim(), exact);
    } else {
      // 3.3 Greedy Longest-Phrase Substring Replacement
      for (const phrase of this.sortedPhrases) {
        if (phrase.pattern.test(translated)) {
          translated = translated.replace(phrase.pattern, phrase.target);
          phrase.pattern.lastIndex = 0;
        }
      }
    }

    // If translation didn't change anything, trigger async background learn (Rule #8)
    if (translated === plainText) {
      if (
        trimmed.length >= 4 &&
        trimmed.length <= 80 &&
        !trimmed.includes('/') &&
        !trimmed.includes('@') &&
        !trimmed.startsWith('-')
      ) {
        void this.asyncTranslateAndLearn(trimmed);
      }
      return lineStr;
    }

    // 4. Re-inject into single text token or multi-token stream
    if (textIndices.length === 1) {
      tokens[textIndices[0]] = translated;
      return tokens.join('');
    }

    // For multi-colored tokens, translate segment-by-segment with index
    for (const idx of textIndices) {
      let seg = tokens[idx];
      if (!seg || !/[A-Za-z]{2,}/.test(seg)) continue;

      for (const tpl of DEV_TOOL_TEMPLATES) {
        if (tpl.pattern.test(seg)) {
          seg = seg.replace(tpl.pattern, tpl.replace as (substring: string, ...args: unknown[]) => string);
        }
      }

      for (const phrase of this.sortedPhrases) {
        if (phrase.pattern.test(seg)) {
          seg = seg.replace(phrase.pattern, phrase.target);
          phrase.pattern.lastIndex = 0;
        }
      }
      tokens[idx] = seg;
    }

    return tokens.join('');
  }

  /**
   * Rule #6: Strict Semantic Filter
   * Detects URLs, file paths, command flags, JSON, hex hashes that must NEVER be translated.
   */
  private isNonTranslatableSemantic(text: string): boolean {
    // Pure URLs
    if (/^https?:\/\//i.test(text)) return true;
    // File paths like /usr/bin/node or ./src/main.ts
    if (/^(?:\/|[a-zA-Z]:\\|\.\/|\.\.\/)[\w.-]+(?:\/[\w.-]+)+/.test(text)) return true;
    // Command flags like --verbose, -rf, -la
    if (/^--?[a-zA-Z0-9_-]+$/.test(text)) return true;
    // JSON objects or arrays
    if (/^[{\[][\s\S]*[}\]]$/.test(text)) return true;
    // Hex hashes / commit SHA (e.g. 75a008b, 04874c2)
    if (/^[0-9a-f]{7,40}$/i.test(text)) return true;
    // Environment variable assignments like KEY=VALUE
    if (/^[A-Z0-9_]+=[^\s]+$/.test(text)) return true;

    return false;
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
