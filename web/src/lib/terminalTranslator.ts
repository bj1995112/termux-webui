import type { Terminal } from '@xterm/xterm';
import { DEV_TOOL_EXACT_DICT, DEV_TOOL_TEMPLATES } from '@termux-webui/shared';

export type TranslateFunction = (text: string) => Promise<string>;

/**
 * Calculates physical terminal column/cell width of a string.
 * ASCII = 1 cell, CJK Chinese/Japanese/Korean = 2 cells.
 */
function getCellWidth(str: string): number {
  let width = 0;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    // CJK Unified Ideographs & Fullwidth forms
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Industrial Stream Terminal Translator with Space-Padding Width Balancing
 * 1. Space-Padding Width Balancer: Deducts added CJK width from trailing padding spaces.
 *    Keeps every line's total physical cell width 100% identical to English original.
 *    Completely prevents line wrapping and eliminates overlapping ghost rows!
 * 2. Single-Pass Tokenizer: Zero cascading duplicate replacements.
 * 3. URL & Path Immunity: 100% untouched links and file paths.
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
   * Transforms stream chunk with Strict Column-Width Balance.
   */
  private transformStream(chunk: string): string {
    if (!/[A-Za-z]{2,}/.test(chunk)) {
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

      // Step 2: Check Dynamic Templates first
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
        // Step 3: Exact whole-line match first
        const trimmedLower = shielded.trim().toLowerCase();
        const wholeExact = this.exactDictMap.get(trimmedLower);
        if (wholeExact) {
          const origWidth = getCellWidth(shielded.trim());
          const newWidth = getCellWidth(wholeExact);
          const diff = newWidth - origWidth;

          if (diff > 0 && shielded.includes(shielded.trim() + ' ')) {
            // Trim padding spaces
            const excessSpaces = ' '.repeat(diff);
            shielded = shielded.replace(shielded.trim() + excessSpaces, wholeExact);
          } else {
            shielded = shielded.replace(shielded.trim(), wholeExact);
          }
        } else {
          // Step 4: Token Replacer with Padding Spaces Compensator
          // Matches token and any immediately following spaces
          shielded = shielded.replace(
            /(\/[a-zA-Z0-9_-]{2,20}|[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)(\s*)/g,
            (match, token: string, spaces: string) => {
              const lower = token.toLowerCase();
              const found = this.exactDictMap.get(lower);
              if (found) {
                const origWidth = getCellWidth(token);
                const newWidth = getCellWidth(found);
                const diff = newWidth - origWidth;

                if (diff > 0 && spaces.length >= diff) {
                  // Deduct added width from trailing spaces to keep line length 100% unchanged!
                  const remainingSpaces = spaces.slice(diff);
                  return found + remainingSpaces;
                }
                return found + spaces;
              }
              return match;
            },
          );
        }
      }

      // Step 5: Restore URLs & Paths
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
