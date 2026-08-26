import { useState } from 'react';
import { useDeck } from '../store.js';
import { testTranslation, type TranslateEngine } from '../lib/translator.js';

export default function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState<'main' | 'settings'>('main');
  const [openSection, setOpenSection] = useState<'translate' | 'terminal' | 'theme' | 'security' | null>('translate');

  // Terminal state
  const rightReservePct = useDeck((s) => s.rightReservePct);
  const setRightReservePct = useDeck((s) => s.setRightReservePct);
  const followOutput = useDeck((s) => s.followOutput);
  const toggleFollowOutput = useDeck((s) => s.toggleFollowOutput);
  const suppressKeyboard = useDeck((s) => s.suppressKeyboard);
  const toggleSuppressKeyboard = useDeck((s) => s.toggleSuppressKeyboard);

  // FocusBar & Translation state
  const focusBarEnabled = useDeck((s) => s.focusBarEnabled);
  const toggleFocusBar = useDeck((s) => s.toggleFocusBar);

  const translateEngine = useDeck((s) => s.translateEngine);
  const setTranslateEngine = useDeck((s) => s.setTranslateEngine);
  const aiApiUrl = useDeck((s) => s.aiApiUrl);
  const setAiApiUrl = useDeck((s) => s.setAiApiUrl);
  const aiApiKey = useDeck((s) => s.aiApiKey);
  const setAiApiKey = useDeck((s) => s.setAiApiKey);
  const aiModel = useDeck((s) => s.aiModel);
  const setAiModel = useDeck((s) => s.setAiModel);
  const customApiUrl = useDeck((s) => s.customApiUrl);
  const setCustomApiUrl = useDeck((s) => s.setCustomApiUrl);

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const close = () => {
    onClose();
    window.setTimeout(() => setPage('main'), 250);
  };

  const toggleSection = (sec: 'translate' | 'terminal' | 'theme' | 'security') => {
    setOpenSection((cur) => (cur === sec ? null : sec));
  };

  const handleTestTranslation = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testTranslation({
        engine: translateEngine,
        aiApiUrl,
        aiApiKey,
        aiModel,
        customApiUrl,
      });
      if (res.ok) {
        setTestResult({ ok: true, msg: `✓ 连通成功！译文："${res.text}" [${res.source}]` });
      } else {
        setTestResult({ ok: false, msg: `✕ 连接失败: ${res.error || '未知错误'}` });
      }
    } catch (e: unknown) {
      setTestResult({ ok: false, msg: `错误: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[80] ${open ? '' : 'pointer-events-none'}`}>
      {/* scrim */}
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* panel */}
      <aside
        className={`absolute inset-y-0 left-0 flex w-[84%] max-w-[340px] flex-col border-r border-border bg-panel shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {page === 'main' ? (
          <>
            <div className="border-b border-border px-4 pb-3 pt-5">
              <p className="text-base font-bold text-accent">▚ Termux WebUI</p>
              <p className="mt-0.5 text-xs text-muted">通用 Agent 控制台 · 手机优先</p>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              <div className="px-4 py-2 text-xs text-muted space-y-1.5">
                <p className="font-semibold text-text">💡 快速提示：</p>
                <p>• 顶栏 💡 释义：一键开/关键盘上方的实时焦点释义条。</p>
                <p>• 上下键移动选项时，0 毫秒极速词库秒出中文。</p>
                <p>• 支持 DeepSeek / OpenAI / 多源容灾自动切换。</p>
              </div>
            </nav>
            <button
              onClick={() => setPage('settings')}
              className="flex items-center gap-3 border-t border-border px-4 py-4 text-left text-sm active:bg-panel2"
            >
              <span className="text-lg leading-none">⚙️</span>
              <span className="font-medium">系统与偏好设置</span>
              <span className="ml-auto text-muted">›</span>
            </button>
          </>
        ) : (
          <>
            {/* Settings Header */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-3">
              <button onClick={() => setPage('main')} className="rounded-lg px-2 py-1 text-sm text-muted active:text-text">
                ‹ 返回
              </button>
              <p className="text-sm font-bold">设置</p>
            </div>

            {/* Accordion Settings Sections */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
              {/* 1. 实时选项释义与翻译设置 */}
              <div className="rounded-xl border border-border bg-panel2/50 overflow-hidden">
                <button
                  onClick={() => toggleSection('translate')}
                  className="flex w-full items-center justify-between px-3.5 py-3 text-left text-sm font-semibold text-text hover:bg-panel2/80 active:bg-panel2"
                >
                  <span className="flex items-center gap-2">
                    <span>💡</span>
                    <span>选项释义与翻译源</span>
                  </span>
                  <span className="text-xs text-muted">{openSection === 'translate' ? '▾' : '▸'}</span>
                </button>

                {openSection === 'translate' && (
                  <div className="border-t border-border/60 p-3.5 space-y-3.5 text-xs">
                    {/* 开启选项释义条 */}
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-text font-medium block">启用选项联动释义条</span>
                        <span className="text-[10px] text-muted block">在键盘上方 0 毫秒同步显示当前选中的中文释义</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={focusBarEnabled}
                        onChange={(e) => toggleFocusBar(e.target.checked)}
                        className="h-4 w-4 accent-accent rounded"
                      />
                    </label>

                    {/* 翻译引擎源 */}
                    <div>
                      <span className="mb-1.5 block text-muted font-medium">翻译引擎源</span>
                      <select
                        value={translateEngine}
                        onChange={(e) => setTranslateEngine(e.target.value as TranslateEngine)}
                        className="w-full rounded-lg border border-border bg-panel px-2.5 py-2 text-xs text-text outline-none focus:border-accent"
                      >
                        <option value="auto">多源自动容灾（推荐：谷歌Web+MyMemory+Edge自动切换）</option>
                        <option value="google">谷歌Web (稳定免配)</option>
                        <option value="mymemory">MyMemory 翻译引擎</option>
                        <option value="edge">微软 Edge 翻译</option>
                        <option value="ai">AI 智能翻译 (DeepSeek / OpenAI / 本地模型)</option>
                        <option value="custom">自定义 HTTP API 端点</option>
                      </select>
                    </div>

                    {/* AI 大模型配置 */}
                    {translateEngine === 'ai' && (
                      <div className="space-y-2 rounded-lg border border-border/80 bg-panel p-2.5">
                        <label className="block">
                          <span className="mb-1 block text-muted">API Base URL</span>
                          <input
                            value={aiApiUrl}
                            onChange={(e) => setAiApiUrl(e.target.value)}
                            placeholder="https://api.deepseek.com/v1"
                            className="w-full rounded border border-border bg-panel2 px-2 py-1 text-xs outline-none focus:border-accent"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-muted">API Key</span>
                          <input
                            type="password"
                            value={aiApiKey}
                            onChange={(e) => setAiApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full rounded border border-border bg-panel2 px-2 py-1 text-xs outline-none focus:border-accent"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-muted">模型名称 (Model)</span>
                          <input
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                            placeholder="deepseek-chat"
                            className="w-full rounded border border-border bg-panel2 px-2 py-1 text-xs outline-none focus:border-accent"
                          />
                        </label>
                        <button
                          onClick={() => void handleTestTranslation()}
                          disabled={testing}
                          className="w-full rounded border border-accent bg-accent/15 py-1.5 text-xs text-accent font-medium active:bg-accent/30 disabled:opacity-50"
                        >
                          {testing ? '正在测试连接…' : '⚡ 测试 AI 翻译连通性'}
                        </button>
                        {testResult && (
                          <p
                            className={`text-[11px] leading-tight break-words ${
                              testResult.ok ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {testResult.msg}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 自定义 API 配置 */}
                    {translateEngine === 'custom' && (
                      <div className="space-y-2 rounded-lg border border-border/80 bg-panel p-2.5">
                        <label className="block">
                          <span className="mb-1 block text-muted">自定义 API URL</span>
                          <input
                            value={customApiUrl}
                            onChange={(e) => setCustomApiUrl(e.target.value)}
                            placeholder="https://your-server.com/translate"
                            className="w-full rounded border border-border bg-panel2 px-2 py-1 text-xs outline-none focus:border-accent"
                          />
                        </label>
                        <button
                          onClick={() => void handleTestTranslation()}
                          disabled={testing}
                          className="w-full rounded border border-accent bg-accent/15 py-1.5 text-xs text-accent font-medium active:bg-accent/30 disabled:opacity-50"
                        >
                          {testing ? '正在测试…' : '⚡ 测试自定义接口'}
                        </button>
                        {testResult && (
                          <p
                            className={`text-[11px] leading-tight break-words ${
                              testResult.ok ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {testResult.msg}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. 终端与交互偏好 */}
              <div className="rounded-xl border border-border bg-panel2/50 overflow-hidden">
                <button
                  onClick={() => toggleSection('terminal')}
                  className="flex w-full items-center justify-between px-3.5 py-3 text-left text-sm font-semibold text-text hover:bg-panel2/80 active:bg-panel2"
                >
                  <span className="flex items-center gap-2">
                    <span>💻</span>
                    <span>终端与交互偏好</span>
                  </span>
                  <span className="text-xs text-muted">{openSection === 'terminal' ? '▾' : '▸'}</span>
                </button>

                {openSection === 'terminal' && (
                  <div className="border-t border-border/60 p-3.5 space-y-3.5 text-xs">
                    {/* 右侧防裁切留白 */}
                    <div>
                      <div className="flex justify-between text-muted mb-1">
                        <span>右侧防裁切留白</span>
                        <span className="text-accent">{rightReservePct}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={20}
                        step={1}
                        value={rightReservePct}
                        onChange={(e) => setRightReservePct(Number(e.target.value))}
                        className="h-5 w-full accent-accent"
                      />
                      <span className="text-[10px] text-muted">在右侧留出空白避免边缘字符被切，0% 为完全铺满</span>
                    </div>

                    {/* 跟随输出 */}
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-text font-medium block">输出自动滚动到底部</span>
                        <span className="text-[10px] text-muted block">有新内容输出时自动滚到底部</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={followOutput}
                        onChange={(e) => toggleFollowOutput(e.target.checked)}
                        className="h-4 w-4 accent-accent rounded"
                      />
                    </label>

                    {/* 屏蔽系统键盘 */}
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-text font-medium block">屏蔽系统软键盘弹出</span>
                        <span className="text-[10px] text-muted block">点击终端时默认不弹出手机输入法，专心使用虚拟键盘</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={suppressKeyboard}
                        onChange={(e) => toggleSuppressKeyboard(e.target.checked)}
                        className="h-4 w-4 accent-accent rounded"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* 3. 主题与外观 (预留) */}
              <div className="rounded-xl border border-border bg-panel2/50 overflow-hidden">
                <button
                  onClick={() => toggleSection('theme')}
                  className="flex w-full items-center justify-between px-3.5 py-3 text-left text-sm font-semibold text-text hover:bg-panel2/80 active:bg-panel2"
                >
                  <span className="flex items-center gap-2">
                    <span>🎨</span>
                    <span>主题与外观风格</span>
                  </span>
                  <span className="text-xs text-muted">{openSection === 'theme' ? '▾' : '▸'}</span>
                </button>

                {openSection === 'theme' && (
                  <div className="border-t border-border/60 p-3.5 text-xs text-muted space-y-2">
                    <p>• 当前主题：Termux 经典深黑 (JetBrains Mono)</p>
                    <p className="text-[11px] italic">（更多配色与字体自定义将在后续版本上线）</p>
                  </div>
                )}
              </div>

              {/* 4. 安全与局域网认证 (预留) */}
              <div className="rounded-xl border border-border bg-panel2/50 overflow-hidden">
                <button
                  onClick={() => toggleSection('security')}
                  className="flex w-full items-center justify-between px-3.5 py-3 text-left text-sm font-semibold text-text hover:bg-panel2/80 active:bg-panel2"
                >
                  <span className="flex items-center gap-2">
                    <span>🔒</span>
                    <span>安全与局域网认证</span>
                  </span>
                  <span className="text-xs text-muted">{openSection === 'security' ? '▾' : '▸'}</span>
                </button>

                {openSection === 'security' && (
                  <div className="border-t border-border/60 p-3.5 text-xs text-muted space-y-2">
                    <p>• 当前模式：本地开放模式 (0.0.0.0)</p>
                    <p className="text-[11px] italic">（局域网 PIN 码与 Token 访问控制将在后续版本上线）</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
