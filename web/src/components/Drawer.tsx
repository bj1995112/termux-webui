import { useState, useEffect } from 'react';
import { useDeck } from '../store.js';
import type { AgentConversation, CliId } from '@termux-webui/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onNewSession: () => void;
}

function formatRelativeTime(ts: number): string {
  if (!ts) return '未知时间';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const CLI_ICONS: Record<string, string> = {
  agy: '🔮',
  claude: '🤖',
  opencode: '💻',
  codex: '⚡',
  pi: '🥧',
  shell: '🐚',
  aider: '🛠️',
  openclaw: '🦞',
  hermes: '🕊️',
};

export default function Drawer({ open, onClose, onNewSession }: Props) {
  const sessions = useDeck((s) => s.sessions);
  const activeId = useDeck((s) => s.activeId);
  const setActive = useDeck((s) => s.setActive);
  const killSession = useDeck((s) => s.killSession);
  const conversations = useDeck((s) => s.conversations);
  const loadHistory = useDeck((s) => s.loadHistory);
  const resumeConversation = useDeck((s) => s.resumeConversation);
  const deleteHistory = useDeck((s) => s.deleteHistory);

  // Terminal preferences
  const followOutput = useDeck((s) => s.followOutput);
  const toggleFollowOutput = useDeck((s) => s.toggleFollowOutput);
  const suppressKeyboard = useDeck((s) => s.suppressKeyboard);
  const toggleSuppressKeyboard = useDeck((s) => s.toggleSuppressKeyboard);

  // Multi-accordion state: allows independent expansion
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    active_terminals: true,
    history_agy: true,
    history_claude: true,
    history_opencode: true,
  });

  // Selected card expansion for seeing more details
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      void loadHistory();
    }
  }, [open, loadHistory]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const close = () => {
    onClose();
  };

  const selectSession = (id: string) => {
    setActive(id);
    close();
  };

  const handleNewSession = () => {
    close();
    window.setTimeout(onNewSession, 120);
  };

  const handleResume = async (conv: AgentConversation) => {
    try {
      await resumeConversation(conv);
      close();
    } catch (err) {
      alert(`恢复会话失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteHistory = async (conv: AgentConversation) => {
    if (confirm(`确定要彻底删除该历史对话存档吗？\n"${conv.title}"`)) {
      await deleteHistory(conv.cli, conv.id);
    }
  };

  // Group conversations by CLI kind
  const cliGroups = conversations.reduce((acc, conv) => {
    const key = conv.cli;
    if (!acc[key]) acc[key] = [];
    acc[key].push(conv);
    return acc;
  }, {} as Record<CliId, AgentConversation[]>);

  const groupKeys = Object.keys(cliGroups) as CliId[];

  return (
    <div className={`fixed inset-0 z-[80] ${open ? '' : 'pointer-events-none'}`}>
      {/* Scrim */}
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Drawer Sidebar */}
      <aside
        className={`absolute inset-y-0 left-0 flex w-[86%] max-w-[360px] flex-col border-r border-border bg-panel shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5 bg-panel2/40">
          <div>
            <p className="text-base font-bold text-accent">▚ Termux WebUI</p>
            <p className="text-xs text-muted">全能 Agent 调度控制台</p>
          </div>
          <button
            onClick={handleNewSession}
            className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow active:bg-accent/80"
          >
            <span>⊕</span>
            <span>新建会话</span>
          </button>
        </div>

        {/* Scrollable Accordion Container */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* =================================================================== */}
          {/* SECTION 1: 当前活跃终端 (Active Running PTY Sessions) */}
          {/* =================================================================== */}
          <div className="rounded-xl border border-border bg-panel2/40 overflow-hidden shadow-sm">
            <button
              onClick={() => toggleSection('active_terminals')}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold text-text hover:bg-panel2/80 active:bg-panel2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">⚡</span>
                <span>当前活跃终端</span>
                <span className="rounded-full bg-accent/20 px-1.5 py-0.2 text-[10px] font-bold text-accent">
                  {sessions.length}
                </span>
              </div>
              <span className="text-xs text-muted">
                {openSections['active_terminals'] ? '▾' : '▸'}
              </span>
            </button>

            {openSections['active_terminals'] && (
              <div className="border-t border-border/60 p-2 space-y-1.5">
                {sessions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted">
                    <p>暂无正在运行的终端</p>
                  </div>
                ) : (
                  sessions.map((s, idx) => {
                    const isCur = s.id === activeId;
                    return (
                      <div
                        key={s.id}
                        onClick={() => selectSession(s.id)}
                        className={`group flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition-colors cursor-pointer ${
                          isCur
                            ? 'border-accent bg-accent/15 shadow-sm'
                            : 'border-border bg-panel hover:bg-panel2 active:bg-panel2'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
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
                                <span className="rounded bg-accent/20 px-1 text-[9px] font-bold text-accent">
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
                          className="flex-shrink-0 rounded p-1 text-muted hover:text-red-400 hover:bg-red-500/10 active:text-red-400"
                          title="关闭会话"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* =================================================================== */}
          {/* SECTION 2+: 动态 AI 编程软件历史对话折叠列表 (Grouped by CLI) */}
          {/* =================================================================== */}
          {groupKeys.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
              <p className="text-sm mb-1">📚 暂未检测到历史对话</p>
              <p className="text-[11px]">当您使用 AI 工具（Agy, Claude 等）完成对话后，将自动在此聚拢归档。</p>
            </div>
          ) : (
            groupKeys.map((cli) => {
              const list = cliGroups[cli] || [];
              const secKey = `history_${cli}`;
              const isOpen = openSections[secKey] ?? true;
              const cliIcon = CLI_ICONS[cli] || '🤖';
              const cliTitle = list[0]?.cliLabel || cli;

              return (
                <div key={cli} className="rounded-xl border border-border bg-panel2/40 overflow-hidden shadow-sm">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleSection(secKey)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold text-text hover:bg-panel2/80 active:bg-panel2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{cliIcon}</span>
                      <span>{cliTitle} 历史对话</span>
                      <span className="rounded-full bg-border px-1.5 py-0.2 text-[10px] font-semibold text-muted">
                        {list.length}
                      </span>
                    </div>
                    <span className="text-xs text-muted">{isOpen ? '▾' : '▸'}</span>
                  </button>

                  {/* Vertically Scrollable Conversation List */}
                  {isOpen && (
                    <div className="border-t border-border/60 p-2 max-h-[300px] overflow-y-auto space-y-1.5 overscroll-contain">
                      {list.map((conv) => {
                        const isExpanded = expandedCardId === conv.id;

                        return (
                          <div
                            key={conv.id}
                            className="rounded-lg border border-border bg-panel p-2.5 transition-all text-xs"
                          >
                            {/* Card Header (Click to toggle details) */}
                            <div
                              onClick={() => setExpandedCardId(isExpanded ? null : conv.id)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-1.5 mb-1">
                                <p className="font-semibold text-text leading-snug line-clamp-2 select-text">
                                  {conv.title}
                                </p>
                                <span className="flex-shrink-0 text-[10px] text-muted">
                                  {formatRelativeTime(conv.updatedAt)}
                                </span>
                              </div>
                              <p className="truncate text-[10px] text-muted font-mono mb-1.5">
                                📁 {conv.cwd}
                              </p>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="mt-2 pt-2 border-t border-border/60 text-[11px] text-muted space-y-1">
                                {conv.firstPrompt && (
                                  <p className="text-text/80 bg-panel2 p-1.5 rounded select-text break-words">
                                    <span className="font-semibold text-accent">问题：</span>
                                    {conv.firstPrompt}
                                  </p>
                                )}
                                <div className="flex items-center justify-between text-[10px] pt-1">
                                  <span>消息数: {conv.messageCount ?? 1} 轮</span>
                                  <span>ID: {conv.id.slice(0, 8)}...</span>
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                              <button
                                onClick={() => void handleResume(conv)}
                                className="flex items-center gap-1 rounded bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25 active:bg-accent active:text-white transition-colors"
                              >
                                <span>🚀</span>
                                <span>恢复继续聊</span>
                              </button>

                              <button
                                onClick={() => void handleDeleteHistory(conv)}
                                className="flex items-center gap-1 rounded p-1 text-[11px] text-muted hover:text-red-400 hover:bg-red-500/10 active:text-red-400 transition-colors"
                                title="删除存档"
                              >
                                <span>🗑️</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* =================================================================== */}
          {/* SECTION: 系统与偏好设置 (Settings Accordion) */}
          {/* =================================================================== */}
          <div className="rounded-xl border border-border bg-panel2/40 overflow-hidden shadow-sm">
            <button
              onClick={() => toggleSection('settings')}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold text-text hover:bg-panel2/80 active:bg-panel2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">⚙️</span>
                <span>系统与偏好设置</span>
              </div>
              <span className="text-xs text-muted">
                {openSections['settings'] ? '▾' : '▸'}
              </span>
            </button>

            {openSections['settings'] && (
              <div className="border-t border-border/60 p-3 space-y-3 text-xs">
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
                    <span className="text-[10px] text-muted block">点击终端时默认不弹出手机输入法</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={suppressKeyboard}
                    onChange={(e) => toggleSuppressKeyboard(e.target.checked)}
                    className="h-4 w-4 accent-accent rounded"
                  />
                </label>

                {/* 状态与字体说明 */}
                <div className="pt-2 border-t border-border/40 text-[10px] text-muted space-y-1">
                  <p>• 字体栈：JetBrains Mono / Roboto Mono</p>
                  <p>• 物理安全边距：10px（自动防切）</p>
                  <p>• 模式：局域网开放 (0.0.0.0)</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
