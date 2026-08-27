import { describe, it, expect } from 'vitest';
import { stripAnsi, translateText } from '../src/translator.js';

describe('Translator Module', () => {
  it('strips ANSI color codes cleanly', () => {
    const colored = '\x1b[31mError:\x1b[0m \x1b[32mfile not found\x1b[0m';
    expect(stripAnsi(colored)).toBe('Error: file not found');
  });

  it('translates text and returns structured response', async () => {
    const res = await translateText('Hello World', 'zh-CN');
    expect(res.ok).toBe(true);
    expect(res.original).toBe('Hello World');
    expect(typeof res.translated).toBe('string');
    expect(res.translated.length).toBeGreaterThan(0);
  });

  it('uses cache on identical subsequent queries', async () => {
    const res1 = await translateText('SyntaxError: Unexpected token', 'zh-CN');
    const res2 = await translateText('SyntaxError: Unexpected token', 'zh-CN');
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    expect(res2.cached).toBe(true);
  });
});
