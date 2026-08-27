import type { TranslationConfig, TranslateResponse } from '@termux-webui/shared';

/** Strip ANSI color/style escape codes */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\([a-zA-Z]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '');
}

/** Comprehensive Local Linux / Shell / Git / AI terminology dictionary for 100% offline accuracy */
const LOCAL_TERMS: Record<string, string> = {
  // General & greetings
  'hello world': '你好，世界',
  'hello': '你好',
  'world': '世界',
  'help': '帮助',
  'version': '版本',
  'status': '状态',
  'welcome': '欢迎',
  'done': '已完成',
  'success': '成功',
  'successful': '成功',
  'failed': '失败',
  'error': '错误',
  'warning': '警告',
  'info': '提示',
  'debug': '调试',

  // Common Linux Errors & Messages
  'permission denied': '权限被拒绝 (请检查文件读写执行权限或使用 sudo/su)',
  'file not found': '文件未找到',
  'no such file or directory': '没有该文件或目录',
  'command not found': '未找到该命令 (请检查拼写或使用 apt install 安装)',
  'cannot find module': '找不到指定的模块',
  'syntaxerror: unexpected token': '语法错误：意外的标记',
  'syntax error': '语法错误',
  'connection refused': '连接被拒绝',
  'connection reset by peer': '连接被对端重置',
  'timed out': '连接超时',
  'network is unreachable': '网络不可达',
  'address already in use': '端口已被占用',
  'is not recognized as an internal or external command': '不是内部或外部命令',
  'fatal error': '致命错误',
  'segmentation fault': '段错误 (内存访问违规)',
  'build successful': '构建成功',
  'compilation failed': '编译失败',
  'disk quota exceeded': '磁盘配额已超出',
  'authentication failed': '身份验证失败 (密码或 Token 错误)',
  'unhandled exception': '未处理的异常',
  'invalid argument': '无效的参数',
  'broken pipe': '管道破裂 (Broken pipe)',
  'out of memory': '内存耗尽 (Out of memory)',
  'resource temporarily unavailable': '资源暂时不可用',
  'too many open files': '打开的文件数过多',
  'device or resource busy': '设备或资源正忙',
  'operation not permitted': '操作不被允许',
  'read-only file system': '只读文件系统',
  'input/output error': '输入/输出错误 (I/O 错误)',
  'unable to locate package': '无法定位指定的软件包',
  'failed to fetch': '下载/获取资源失败',
  'could not resolve host': '无法解析主机域名',
  'certificate verification failed': 'SSL 证书验证失败',
  'package not found': '软件包未找到',

  // Git & Shell Commands / Status
  'repository': '代码仓库',
  'branch': '分支',
  'commit': '提交',
  'merge': '合并',
  'rebase': '变基',
  'checkout': '检出/切换分支',
  'cherry-pick': '挑选提交',
  'stash': '暂存更改',
  'pull request': '拉取请求 (PR)',
  'conflict': '冲突',
  'up to date': '已是最新',
  'working tree clean': '工作区干净，无待提交的更改',
  'changes not staged for commit': '已修改但未暂存的更改',
  'untracked files': '未跟踪的新文件',
  'nothing to commit': '无内容需要提交',
  'ahead of': '领先于',
  'behind': '落后于',

  // Actions & Controls
  'copy': '复制',
  'paste': '粘贴',
  'select all': '全选',
  'cancel': '取消',
  'restart': '重新启动',
  'delete': '删除',
  'clear': '清除',
  'close': '关闭',
  'save': '保存',
  'load': '加载',
  'refresh': '刷新',
  'preview': '预览',
  'resume': '恢复',
  'settings': '设置',
  'terminal': '终端',
  'session': '会话',
};

/** In-memory cache for fast repeated query responses */
const translationCache = new Map<string, { translated: string; fromLang: string; source: string; time: number }>();
const MAX_CACHE_ENTRIES = 1000;

function getCacheKey(text: string, toLang: string, config?: TranslationConfig): string {
  const provider = config?.provider || 'auto';
  const customKey = config?.provider === 'custom_llm' ? `${config.customModel}_${config.customBaseUrl}` : '';
  return `${provider}:${customKey}:${toLang}:${text.trim()}`;
}

/** Fetch with timeout wrapper */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/** Source 1: Youdao Mobile Full Sentence Translation (100% available without VPN) */
async function translateWithYoudaoMobile(text: string): Promise<{ translated: string; fromLang: string }> {
  const form = new URLSearchParams();
  form.append('inputtext', text);
  form.append('type', 'AUTO');

  const res = await fetchWithTimeout(
    'https://m.youdao.com/translate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      },
      body: form,
    },
    2500,
  );

  if (!res.ok) throw new Error(`Youdao Mobile returned HTTP ${res.status}`);
  const html = await res.text();
  const match = /<ul id="translateResult">([\s\S]*?)<\/ul>/.exec(html);
  if (match) {
    const items = [...match[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].trim());
    if (items.length > 0) {
      return { translated: items.join('\n'), fromLang: 'auto' };
    }
  }
  throw new Error('Youdao Mobile did not match result');
}

/** Source 2: Youdao Dictionary Word/Phrase Suggest API (Fast Domestic Term Lookup) */
async function translateWithYoudaoSuggest(text: string): Promise<{ translated: string; fromLang: string }> {
  const url = `https://dict.youdao.com/suggest?num=1&doctype=json&q=${encodeURIComponent(text.slice(0, 100))}`;
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    },
    1500,
  );

  if (!res.ok) throw new Error(`Youdao suggest returned HTTP ${res.status}`);
  const data = (await res.json()) as {
    result?: { code?: number };
    data?: { entries?: { explain?: string; entry?: string }[] };
  };

  if (data.result?.code === 200 && data.data?.entries && data.data.entries.length > 0) {
    const explain = data.data.entries[0]?.explain?.trim();
    if (explain) {
      return { translated: explain, fromLang: 'en' };
    }
  }
  throw new Error('Youdao suggest did not find matching term');
}

/** Source 3: Google Translate Public RPC (Fallback if proxy active) */
async function translateWithGoogle(text: string, toLang = 'zh-CN'): Promise<{ translated: string; fromLang: string }> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(toLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
    },
    2000,
  );

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

/** Format and normalize Custom LLM URL */
function normalizeLlmEndpoint(rawUrl: string): string {
  let url = rawUrl.trim().replace(/\/+$/, '');
  if (url.endsWith('/chat/completions')) return url;
  if (!url.endsWith('/v1')) {
    // If user provided base like https://api.deepseek.com or https://api.openai.com
    url = `${url}/v1`;
  }
  return `${url}/chat/completions`;
}

/** Source 4: User-defined Custom LLM (DeepSeek, OpenAI, Ollama) */
async function translateWithCustomLLM(
  text: string,
  config: TranslationConfig,
  toLang = '简体中文',
): Promise<{ translated: string; fromLang: string }> {
  if (!config.customBaseUrl?.trim()) {
    throw new Error('未配置 API 根地址 (Base URL)');
  }

  const endpoint = normalizeLlmEndpoint(config.customBaseUrl);
  const model = config.customModel?.trim() || 'deepseek-chat';
  const apiKey = config.customApiKey?.trim() || '';

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
    endpoint,
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
    10000,
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let parsedMsg = errText.slice(0, 150);
    try {
      const errObj = JSON.parse(errText) as { error?: { message?: string } };
      if (errObj.error?.message) parsedMsg = errObj.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(`API 响应错误 (HTTP ${res.status}): ${parsedMsg}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('API 返回消息内容为空');

  return { translated: content, fromLang: 'auto' };
}

/** Local Dictionary Lookup */
function translateWithLocalDict(text: string): string | null {
  const lower = text.trim().toLowerCase();
  if (LOCAL_TERMS[lower]) return LOCAL_TERMS[lower];
  for (const [key, val] of Object.entries(LOCAL_TERMS)) {
    if (lower === key || lower.includes(key)) {
      return text.replace(new RegExp(key, 'gi'), val);
    }
  }
  return null;
}

/** Unified Multi-source Translation */
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

  // 2. Custom LLM path (if user explicitly selected custom_llm)
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
      const errMsg = e instanceof Error ? e.message : String(e);
      console.warn('Custom LLM translation failed:', errMsg);
      return {
        ok: false,
        original: clean,
        translated: clean,
        fromLang: 'en',
        toLang,
        error: `自定义大模型翻译失败: ${errMsg}`,
      };
    }
  }

  // 3. Fast Local Linux Dictionary Check (Instant 0ms match)
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

  // 4. Youdao Mobile Sentence / Term API (100% domestic reachable)
  try {
    const yd = await translateWithYoudaoMobile(clean);
    saveCache(cacheKey, yd.translated, yd.fromLang, 'Youdao Engine');
    return {
      ok: true,
      original: clean,
      translated: yd.translated,
      fromLang: yd.fromLang,
      toLang,
      sourceUsed: 'Youdao Engine',
    };
  } catch {
    /* fallback to suggest */
  }

  // 5. Youdao Dictionary Suggest (for words & short phrases)
  try {
    const ys = await translateWithYoudaoSuggest(clean);
    saveCache(cacheKey, ys.translated, ys.fromLang, 'Youdao Dictionary');
    return {
      ok: true,
      original: clean,
      translated: ys.translated,
      fromLang: ys.fromLang,
      toLang,
      sourceUsed: 'Youdao Dictionary',
    };
  } catch {
    /* try next */
  }

  // 6. Google Translate (if accessible)
  try {
    const gg = await translateWithGoogle(clean, toLang);
    saveCache(cacheKey, gg.translated, gg.fromLang, 'Google Translate');
    return {
      ok: true,
      original: clean,
      translated: gg.translated,
      fromLang: gg.fromLang,
      toLang,
      sourceUsed: 'Google Translate',
    };
  } catch {
    /* fallback */
  }

  return {
    ok: false,
    original: clean,
    translated: clean,
    fromLang: 'en',
    toLang,
    error: '公共翻译接口连接超时，请检查网络或配置自定义大模型 API',
  };
}

function saveCache(key: string, translated: string, fromLang: string, source: string) {
  if (translationCache.size >= MAX_CACHE_ENTRIES) {
    const first = translationCache.keys().next().value;
    if (first) translationCache.delete(first);
  }
  translationCache.set(key, { translated, fromLang, source, time: Date.now() });
}
