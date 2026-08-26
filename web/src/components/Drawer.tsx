import { useState } from 'react';
import { useDeck } from '../store.js';

export default function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState<'main' | 'settings'>('main');
  const [openSection, setOpenSection] = useState<'terminal' | 'theme' | 'security' | null>('terminal');

  // Terminal state
  const rightReservePct = useDeck((s) => s.rightReservePct);
  const setRightReservePct = useDeck((s) => s.setRightReservePct);
  const followOutput = useDeck((s) => s.followOutput);
  const toggleFollowOutput = useDeck((s) => s.toggleFollowOutput);
  const suppressKeyboard = useDeck((s) => s.suppressKeyboard);
  const toggleSuppressKeyboard = useDeck((s) => s.toggleSuppressKeyboard);

  const close = () => {
    onClose();
    window.setTimeout(() => setPage('main'), 250);
  };

  const toggleSection = (sec: 'terminal' | 'theme' | 'security') => {
    setOpenSection((cur) => (cur === sec ? null : sec));
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
                <p>• 长按终端屏幕可自由划选文本并快速复制。</p>
                <p>• 点击右上角 ⊕ 随时开启多个独立终端会话。</p>
                <p>• 底部快捷键盘支持一键按键盲操。</p>
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
              {/* 1. 终端与交互偏好 */}
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

              {/* 2. 主题与外观 (预留) */}
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

              {/* 3. 安全与局域网认证 (预留) */}
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
