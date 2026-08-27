import type { TranslationConfig, TranslateResponse } from '@termux-webui/shared';

/** Strip ANSI color/style escape codes */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\([a-zA-Z]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '');
}

/** Local common Linux / Shell / AI terminology dictionary for offline fallback */
const LOCAL_TERMS: Record<string, string> = {
  'hello world': '你好，世界',
  'file not found': '文件未找到',
  'no such file or directory': '没有那个文件或目录',
  'permission denied': '权限被拒绝',
  'command not found': '未找到命令',
  'syntaxerror: unexpected token': '语法错误：意外的标记',
  'connection refused': '连接被拒绝',
  'timed out': '连接超时',
  'address already in use': '端口地址已被占用',
  'is not recognized as an internal or external command': '不是内部或外部命令',
  'fatal error': '致命错误',
  'segmentation fault': '段错误 (内存访问违规)',
  'build successful': '构建成功',
  'compilation failed': '编译失败',
  'disk quota exceeded': '磁盘配额已超出',
  'authentication failed': '身份验证失败',
};

/** In-memory cache for fast repeated query responses */
const translationCache = new Map<string, { translated: string; fromLang: string; source: string; time: number }>();
const MAX_CACHE_ENTRIES = 500;

function getCacheKey(text: string, toLang: string, config?: TranslationConfig): string {
  const provider = config?.provider || 'auto';
  const customKey = config?.provider === 'custom_llm' ? `${config.customModel}_${config.customBaseUrl}` : '';
  return `${provider}:${customKey}:${toLang}:${text.trim()}`;
}

/** Fetch with timeout wrapper */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/** Source 1: Google Translate Public RPC (Ultra-fast) */
async function translateWithGoogle(text: string, toLang = 'zh-CN'): Promise<{ translated: string; fromLang: string }> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(toLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    },
  }, 2000);

  if (!res.ok) throw new Error(`Google translate returned HTTP ${res.status}`);
  const data = (await res.json()) as unknown[];
  
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const translated = (data[0] as unknown[][])
      .map((item) => (Array.isArray(item) && typeof item[0] === 'string' ? item[0] : ''))
      .join('');
    const fromLang = typeof data[2] === 'string' ? (data[2] as string) : 'en';
    if (translated) return { translated, fromLang };
  }
  throw new Error('Google translate returned unexpected structure');
}

/** Source 2: Lingva Open Alternative Mirror */
async function translateWithLingva(text: string, toLang = 'zh'): Promise<{ translated: string; fromLang: string }> {
  const cleanTo = toLang.startsWith('zh') ? 'zh' : toLang;
  const mirrors = [
    'https://lingva.ml/api/v1/auto',
    'https://translate.plausibility.cloud/api/v1/auto',
  ];

  for (const mirror of mirrors) {
    try {
      const url = `${mirror}/${cleanTo}/${encodeURIComponent(text)}`;
      const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Termux-WebUI' } }, 1500);
      if (res.ok) {
        const data = (await res.json()) as { translation?: string; info?: { detectedSource?: string } };
        if (data.translation) {
          return {
            translated: data.translation,
            fromLang: data.info?.detectedSource || 'en',
          };
        }
      }
    } catch {
      /* try next mirror */
    }
  }
  throw new Error('All Lingva mirrors failed');
}

/** Source 3: User-defined Custom LLM (e.g. DeepSeek, OpenAI, Ollama) */
async function translateWithCustomLLM(
  text: string,
  config: TranslationConfig,
  toLang = '简体中文',
): Promise<{ translated: string; fromLang: string }> {
  if (!config.customBaseUrl) throw new Error('Custom LLM Base URL is missing');

  const baseUrl = config.customBaseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;
  const model = config.customModel || 'deepseek-chat';
  const apiKey = config.customApiKey || '';

  const systemPrompt =
    config.customPrompt ||
    `你是一个专业的 Linux 终端与程序代码翻译器。
请将输入内容翻译为地道的${toLang}。
【关键要求】：
1. 严格保留代码块、Shell 命令（如 git, cd, npm 等）、参数选项（如 -rf, --help 等）、文件路径、变量名与特殊符号的原样，绝不随意翻译成中文。
2. 仅翻译自然语言解释、日志提示与错误描述。
3. 直接输出翻译结果，不要带有任何多余的前缀、解释或 Markdown 格式包裹。`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
      }),
    },
    6000,
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Custom LLM HTTP ${res.status}: ${errText.slice(0, 100)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Custom LLM returned empty message content');

  return { translated: content, fromLang: 'auto' };
}

/** Local Dictionary Lookup */
function translateWithLocalDict(text: string): string | null {
  const lower = text.trim().toLowerCase();
  if (LOCAL_TERMS[lower]) return LOCAL_TERMS[lower];
  for (const [key, val] of Object.entries(LOCAL_TERMS)) {
    if (lower.includes(key)) {
      return text.replace(new RegExp(key, 'gi'), val);
    }
  }
  return null;
}

/** Unified Multi-source Translation with Auto-Failover */
export async function translateText(
  rawText: string,
  toLang = 'zh-CN',
  config?: TranslationConfig,
): Promise<TranslateResponse> {
  const clean = stripAnsi(rawText).trim();
  if (!clean) {
    return {
      ok: true,
      original: rawText,
      translated: rawText,
      fromLang: 'en',
      toLang,
      sourceUsed: 'noop',
    };
  }

  // 1. Cache lookup (0ms)
  const cacheKey = getCacheKey(clean, toLang, config);
  const cached = translationCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 3600000 * 24) {
    return {
      ok: true,
      original: clean,
      translated: cached.translated,
      fromLang: cached.fromLang,
      toLang,
      sourceUsed: `${cached.source} (cache)`,
      cached: true,
    };
  }

  // 2. Custom LLM path (if user configured)
  if (config?.provider === 'custom_llm') {
    try {
      const res = await translateWithCustomLLM(clean, config, toLang);
      saveCache(cacheKey, res.translated, res.fromLang, 'custom_llm');
      return {
        ok: true,
        original: clean,
        translated: res.translated,
        fromLang: res.fromLang,
        toLang,
        sourceUsed: `Custom LLM (${config.customModel || 'default'})`,
      };
    } catch (e) {
      console.warn('Custom LLM translation failed, falling back to auto engines:', e);
    }
  }

  // 3. Fast Concurrent Race & Failover (Google vs Lingva)
  try {
    const winner = await Promise.any([
      translateWithGoogle(clean, toLang).then((r) => ({ ...r, source: 'Google Translate' })),
      translateWithLingva(clean, toLang).then((r) => ({ ...r, source: 'Lingva Mirror' })),
    ]);
    saveCache(cacheKey, winner.translated, winner.fromLang, winner.source);
    return {
      ok: true,
      original: clean,
      translated: winner.translated,
      fromLang: winner.fromLang,
      toLang,
      sourceUsed: winner.source,
    };
  } catch {
    /* all online sources failed -> try local dict */
  }

  // 4. Local Linux Dictionary Fallback
  const localMatch = translateWithLocalDict(clean);
  if (localMatch) {
    saveCache(cacheKey, localMatch, 'en', 'Local Linux Terms');
    return {
      ok: true,
      original: clean,
      translated: localMatch,
      fromLang: 'en',
      toLang,
      sourceUsed: 'Local Linux Dictionary',
    };
  }

  // Graceful fallback: return original text
  return {
    ok: true,
    original: clean,
    translated: clean,
    fromLang: 'en',
    toLang,
    sourceUsed: 'Fallback (Original)',
  };
}

function saveCache(key: string, translated: string, fromLang: string, source: string) {
  if (translationCache.size >= MAX_CACHE_ENTRIES) {
    const first = translationCache.keys().next().value;
    if (first) translationCache.delete(first);
  }
  translationCache.set(key, { translated, fromLang, source, time: Date.now() });
}
