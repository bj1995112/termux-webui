/**
 * Server-side robust translation service with Multi-Source Auto-Failover.
 * Runs in Node.js environment - completely free of browser CORS restrictions.
 */

export interface TranslateParams {
  engine: 'auto' | 'google' | 'mymemory' | 'edge' | 'ai' | 'custom';
  aiApiUrl?: string;
  aiApiKey?: string;
  aiModel?: string;
  customApiUrl?: string;
}

// In-memory cache for fast repeated queries
const cache = new Map<string, string>();
const MAX_CACHE = 600;

function getCached(key: string): string | undefined {
  return cache.get(key);
}

function setCached(key: string, val: string) {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, val);
}

export function cleanText(raw: string): string {
  return raw
    .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏◐◓◑◒◜◝◞◟]/g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .trim();
}

/** 1. Google Web Mobile Endpoint (Highly stable, no 429 blocks) */
export async function translateGoogleWeb(text: string): Promise<string> {
  const url = `https://translate.google.com/m?q=${encodeURIComponent(text)}&tl=zh-CN&sl=auto`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Google Web status ${res.status}`);
  const html = await res.text();
  const match = html.match(/<div[^>]*class=["']result-container["'][^>]*>([\s\S]*?)<\/div>/i);
  if (match && match[1]) {
    const clean = match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    if (clean) return clean;
  }
  throw new Error('Google Web parsed empty');
}

/** 2. MyMemory Translation API */
export async function translateMyMemory(text: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`MyMemory status ${res.status}`);
  const data = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number };
  const out = data?.responseData?.translatedText?.trim();
  if (out && !out.includes('MYMEMORY WARNING')) return out;
  throw new Error('MyMemory invalid text');
}

/** 3. Google Translate GTX Endpoint */
export async function translateGoogleGTX(text: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(
    text,
  )}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Google GTX status ${res.status}`);
  const data = (await res.json()) as unknown;
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const out = data[0].map((item: unknown[]) => (typeof item?.[0] === 'string' ? item[0] : '')).join('').trim();
    if (out) return out;
  }
  throw new Error('Google GTX empty');
}

/** 4. Microsoft Edge Translation endpoint */
export async function translateEdge(text: string): Promise<string> {
  const authRes = await fetch('https://edge.microsoft.com/translate/auth', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/120.0.0.0' },
    signal: AbortSignal.timeout(4000),
  });
  const token = await authRes.text();
  const transRes = await fetch('https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=zh-Hans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify([{ Text: text }]),
    signal: AbortSignal.timeout(5000),
  });
  if (!transRes.ok) throw new Error(`Edge status ${transRes.status}`);
  const data = (await transRes.json()) as Array<{ translations?: Array<{ text?: string }> }>;
  const result = data?.[0]?.translations?.[0]?.text?.trim();
  if (result) return result;
  throw new Error('Edge empty');
}

/** 5. OpenAI-compatible AI API */
export async function translateWithAI(text: string, params: TranslateParams): Promise<string> {
  const base = (params.aiApiUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const model = params.aiModel || 'deepseek-chat';
  const apiKey = params.aiApiKey || '';

  const systemPrompt =
    'You are a developer translation assistant. Translate the following terminal CLI option, question, or prompt into clear Simplified Chinese (简体中文). Keep command names, flags, and shortcuts intact. Output ONLY the translated Chinese text.';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI API [${res.status}]: ${errText.slice(0, 100)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('AI returned empty response');
  return content;
}

/** 6. Custom HTTP Endpoint */
export async function translateCustom(text: string, params: TranslateParams): Promise<string> {
  if (!params.customApiUrl) throw new Error('Custom API URL not set');
  const res = await fetch(params.customApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target: 'zh-CN' }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Custom API status ${res.status}`);
  const data = (await res.json()) as { translatedText?: string; text?: string; result?: string };
  return data?.translatedText || data?.text || data?.result || JSON.stringify(data);
}

/** Multi-source Failover Runner */
export async function performTranslation(rawText: string, params: TranslateParams): Promise<{ text: string; source: string }> {
  const text = cleanText(rawText);
  if (!text || text.length <= 1) return { text, source: 'raw' };

  const cacheKey = `${params.engine}:${text}`;
  const cached = getCached(cacheKey);
  if (cached) return { text: cached, source: 'cache' };

  // If user selected explicit engine
  if (params.engine === 'ai') {
    try {
      const res = await translateWithAI(text, params);
      setCached(cacheKey, res);
      return { text: res, source: 'AI智能' };
    } catch (e) {
      console.warn('[translate AI failed, fallback to auto]', e);
    }
  } else if (params.engine === 'custom') {
    try {
      const res = await translateCustom(text, params);
      setCached(cacheKey, res);
      return { text: res, source: '自定义' };
    } catch (e) {
      console.warn('[translate Custom failed, fallback to auto]', e);
    }
  }

  // Multi-source Auto Failover Pipeline
  const sources: Array<{ name: string; fn: () => Promise<string> }> = [
    { name: '谷歌Web', fn: () => translateGoogleWeb(text) },
    { name: 'MyMemory', fn: () => translateMyMemory(text) },
    { name: '微软Edge', fn: () => translateEdge(text) },
    { name: '谷歌GTX', fn: () => translateGoogleGTX(text) },
  ];

  for (const s of sources) {
    try {
      const result = await s.fn();
      if (result && result.trim().length > 0) {
        setCached(cacheKey, result);
        return { text: result, source: s.name };
      }
    } catch (err) {
      // automatically try next source
      continue;
    }
  }

  // Ultimate fallback: return original text
  return { text, source: '原文' };
}
