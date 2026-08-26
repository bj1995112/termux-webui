import { useState } from 'react';
import { useDeck } from '../store.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onNewSession: () => void;
}

export default function Drawer({ open, onClose, onNewSession }: Props) {
  const [page, setPage] = useState<'main' | 'settings'>('main');
  const [openSection, setOpenSection] = useState<'terminal' | 'theme' | 'security' | null>('terminal');

  const sessions = useDeck((s) => s.sessions);
  const activeId = useDeck((s) => s.activeId);
  const setActive = useDeck((s) => s.setActive);
  const killSession = useDeck((s) => s.killSession);

  // Terminal preferences
  const followOutput = useDeck((s) => s.followOutput);
  const toggleFollowOutput = useDeck((s) => s.toggleFollowOutput);
  const suppressKeyboard = useDeck((s) => s.suppressKeyboard);
  const toggleSuppressKeyboard = useDeck((s) => s.toggleSuppressKeyboard);

  const close = () => {
    onClose();
    window.setTimeout(() => setPage('main'), 250);
  };

  const selectSession = (id: string) => {
    setActive(id);
    close();
  };

  const handleNewSession = () => {
    close();
    window.setTimeout(onNewSession, 150);
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
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border px-4 pb-3.5 pt-5">
              <div>
                <p className="text-base font-bold text-accent">▚ Termux WebUI</p>
                <p className="text-xs text-muted">多会话控制中心</p>
              </div>
              <button
                onClick={handleNewSession}
                className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm active:bg-accent/80"
              >
                <span>⊕</span>
                <span>新建</span>
              </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[11px] font-bold text-muted tracking-wider uppercase">
                  终端会话 ({sessions.length})
                </span>
                <span className="text-[10px] text-muted">点击切换</span>
              </div>

              {sessions.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted border border-dashed border-border rounded-xl">
                  <p>暂无活跃终端</p>
                  <button
                    onClick={handleNewSession}
                    className="mt-2 text-accent underline underline-offset-2"
                  >
                    点击新建一个
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sessions.map((s, idx) => {
                    const isCur = s.id === activeId;
                    return (
                      <div
                        key={s.id}
                        onClick={() => selectSession(s.id)}
                        className={`group flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors cursor-pointer ${
                          isCur
                            ? 'border-accent bg-accent/15 shadow-sm'
                            : 'border-border bg-panel2/60 hover:bg-panel2 active:bg-panel2'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <span
                            className={`h-2 w-2 flex-shrink-0 rounded-full ${
                              isCur ? 'bg-accent animate-pulse' : 'bg-emerald-400'
                            }`}
                          />
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-text">
                                #{idx + 1} {s.kind}
                              </span>
                              {isCur && (
                                <span className="rounded bg-accent/20 px-1 py-0.2 text-[9px] font-bold text-accent">
                                  当前
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[10px] text-muted font-mono">
                              {s.cwd || '~'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void killSession(s.id);
                          }}
                          className="flex-shrink-0 rounded-md p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 active:text-red-400"
                          title="关闭会话"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom: Settings Nav Button */}
            <button
              onClick={() => setPage('settings')}
              className="flex items-center gap-3 border-t border-border bg-panel2/30 px-4 py-3.5 text-left text-sm active:bg-panel2"
            >
              <span className="text-base leading-none">⚙️</span>
              <span className="font-medium text-text">系统与偏好设置</span>
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

              {/* 2. 主题与外观 */}
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
                    <p>• 当前字体栈：JetBrains Mono / Roboto Mono</p>
                    <p>• 自动物理网格安全边距已激活（防裁切）</p>
                  </div>
                )}
              </div>

              {/* 3. 安全与局域网认证 */}
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
