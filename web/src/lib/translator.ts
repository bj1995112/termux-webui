/**
 * Frontend Translation Client.
 * Routes translation requests through backend `/api/translate` with Multi-Source Auto-Failover.
 */

export type TranslateEngine = 'auto' | 'google' | 'mymemory' | 'edge' | 'ai' | 'custom';
export type TranslateMode = 'bilingual' | 'zh_only' | 'raw_only';

export interface TranslateConfig {
  engine: TranslateEngine;
  aiApiUrl?: string;
  aiApiKey?: string;
  aiModel?: string;
  customApiUrl?: string;
}

export interface TranslateResult {
  text: string;
  source: string;
}

// In-memory LRU cache
const cache = new Map<string, TranslateResult>();
const MAX_CACHE = 400;

function getCached(key: string): TranslateResult | undefined {
  return cache.get(key);
}

function setCached(key: string, val: TranslateResult) {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, val);
}

/** Filter out spinner characters, progress bars and raw ANSI artifacts */
export function cleanTerminalText(raw: string): string {
  return raw
    .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏◐◓◑◒◜◝◞◟]/g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .trim();
}

/** Main translation entry point via backend proxy */
export async function translateText(text: string, config: TranslateConfig): Promise<TranslateResult> {
  const clean = cleanTerminalText(text);
  if (!clean || clean.length <= 1) return { text: clean, source: 'raw' };

  const cacheKey = `${config.engine}:${clean}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: clean,
      engine: config.engine,
      aiConfig: {
        apiUrl: config.aiApiUrl,
        apiKey: config.aiApiKey,
        model: config.aiModel,
      },
      customUrl: config.customApiUrl,
    }),
  });

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData?.error || `Translate failed (${res.status})`);
  }

  const data = (await res.json()) as { ok: boolean; result?: string; source?: string; error?: string };
  if (!data.ok || typeof data.result !== 'string') {
    throw new Error(data.error || 'Translation failed');
  }

  const result: TranslateResult = {
    text: data.result,
    source: data.source || 'auto',
  };
  setCached(cacheKey, result);
  return result;
}

/** Test translation connection */
export async function testTranslation(config: TranslateConfig): Promise<{ ok: boolean; text?: string; source?: string; error?: string }> {
  try {
    const sample = 'Allow command execution and file modification? [y/N]';
    const res = await translateText(sample, config);
    return { ok: true, text: res.text, source: res.source };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
