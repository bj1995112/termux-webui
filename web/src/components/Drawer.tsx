import { useState, useEffect, useMemo } from 'react';
import { useDeck } from '../store.js';
import type { AgentConversation, CliId } from '@termux-webui/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onNewSession: () => void;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Formats friendly time for top-right of unexpanded card */
function formatFriendlyTime(ts?: number): string {
  if (!ts) return '未知时间';
  const now = Date.now();
  const diff = now - ts;
  if (diff >= 0 && diff < 60000) return '刚刚';
  if (diff >= 0 && diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;

  const d = new Date(ts);
  const today = new Date(now);
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  if (isToday) {
    return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const yesterday = new Date(now - 86400000);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) {
    return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  if (d.getFullYear() === today.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** Formats exact date down to second for expanded card details */
function formatExactDate(ts?: number): string {
  if (!ts) return '未知时间';
  const d = new Date(ts);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const CLI_CONFIG: Record<string, { icon: string; name: string; color: string }> = {
  codex: { icon: '⚡', name: 'Codex', color: 'text-amber-400 bg-amber-400/15 border-amber-400/30' },
  pi: { icon: '🥧', name: 'Pi Agent', color: 'text-rose-400 bg-rose-400/15 border-rose-400/30' },
  agy: { icon: '🔮', name: 'Antigravity', color: 'text-cyan-400 bg-cyan-400/15 border-cyan-400/30' },
  claude: { icon: '🤖', name: 'Claude', color: 'text-purple-400 bg-purple-400/15 border-purple-400/30' },
  opencode: { icon: '💻', name: 'OpenCode', color: 'text-blue-400 bg-blue-400/15 border-blue-400/30' },
  shell: { icon: '🐚', name: 'Shell', color: 'text-emerald-400 bg-emerald-400/15 border-emerald-400/30' },
  aider: { icon: '🛠️', name: 'Aider', color: 'text-yellow-400 bg-yellow-400/15 border-yellow-400/30' },
  openclaw: { icon: '🦞', name: 'OpenClaw', color: 'text-red-400 bg-red-400/15 border-red-400/30' },
  hermes: { icon: '🕊️', name: 'Hermes', color: 'text-indigo-400 bg-indigo-400/15 border-indigo-400/30' },
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

  // Accordion state
  const [openActive, setOpenActive] = useState(true);
  const [openHistory, setOpenHistory] = useState(true);
  const [openSettings, setOpenSettings] = useState(false);

  // History filtering & search
  const [activeCliFilter, setActiveCliFilter] = useState<'all' | CliId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      void loadHistory();
    }
  }, [open, loadHistory]);

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

  // Group stats for filter pills
  const countsByCli = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of conversations) {
      map[c.cli] = (map[c.cli] || 0) + 1;
    }
    return map;
  }, [conversations]);

  const availableClis = useMemo(() => {
    return Object.keys(countsByCli) as CliId[];
  }, [countsByCli]);

  // Filtered conversation list
  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (activeCliFilter !== 'all') {
      list = list.filter((c) => c.cli === activeCliFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.cwd.toLowerCase().includes(q) ||
          (c.firstPrompt && c.firstPrompt.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [conversations, activeCliFilter, searchQuery]);

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
        className={`absolute inset-y-0 left-0 flex w-[88%] max-w-[370px] flex-col border-r border-border bg-panel shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5 bg-panel2/50">
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

        {/* Scrollable Accordion Canvas */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* =================================================================== */}
          {/* 1. 当前活跃终端 (Active Running Sessions) */}
          {/* =================================================================== */}
          <div className="rounded-xl border border-border bg-panel2/40 overflow-hidden shadow-sm">
            <button
              onClick={() => setOpenActive(!openActive)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold text-text hover:bg-panel2/80 active:bg-panel2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">⚡</span>
                <span>当前活跃终端</span>
                <span className="rounded-full bg-accent/20 px-1.5 py-0.2 text-[10px] font-bold text-accent">
                  {sessions.length}
                </span>
              </div>
              <span className="text-xs text-muted">{openActive ? '▾' : '▸'}</span>
            </button>

            {openActive && (
              <div className="border-t border-border/60 p-2 space-y-1.5">
                {sessions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted">
                    <p>暂无正在运行的终端</p>
                  </div>
                ) : (
                  sessions.map((s, idx) => {
                    const isCur = s.id === activeId;
                    const conf = CLI_CONFIG[s.kind] || { icon: '🐚', name: s.kind, color: '' };
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
                                #{idx + 1} {conf.icon} {s.kind}
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
          {/* 2. 统一 AI 历史对话中枢 (Unified Historical Conversations Hub) */}
          {/* =================================================================== */}
          <div className="rounded-xl border border-border bg-panel2/40 overflow-hidden shadow-sm">
            <button
              onClick={() => setOpenHistory(!openHistory)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold text-text hover:bg-panel2/80 active:bg-panel2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">📚</span>
                <span>AI 历史对话中枢</span>
                <span className="rounded-full bg-border px-1.5 py-0.2 text-[10px] font-semibold text-muted">
                  {conversations.length}
                </span>
              </div>
              <span className="text-xs text-muted">{openHistory ? '▾' : '▸'}</span>
            </button>

            {openHistory && (
              <div className="border-t border-border/60 p-2.5 space-y-2">
                {/* 1. Horizontal Scrollable Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                  <button
                    onClick={() => setActiveCliFilter('all')}
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 font-semibold border transition-all ${
                      activeCliFilter === 'all'
                        ? 'border-accent bg-accent text-white shadow-sm'
                        : 'border-border bg-panel text-muted hover:text-text'
                    }`}
                  >
                    ★ 全部 ({conversations.length})
                  </button>

                  {availableClis.map((cli) => {
                    const count = countsByCli[cli] || 0;
                    const conf = CLI_CONFIG[cli] || { icon: '🤖', name: cli };
                    const isSelected = activeCliFilter === cli;
                    return (
                      <button
                        key={cli}
                        onClick={() => setActiveCliFilter(cli)}
                        className={`flex-shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold border transition-all ${
                          isSelected
                            ? 'border-accent bg-accent text-white shadow-sm'
                            : 'border-border bg-panel text-muted hover:text-text'
                        }`}
                      >
                        <span>{conf.icon}</span>
                        <span>{conf.name}</span>
                        <span className="opacity-80">({count})</span>
                      </button>
                    );
                  })}
                </div>

                {/* 2. Search Box */}
                {conversations.length > 5 && (
                  <input
                    type="text"
                    placeholder="🔍 搜索对话标题或项目路径..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
                  />
                )}

                {/* 3. Unified Continuous Scrollable Conversation List */}
                <div className="max-h-[340px] overflow-y-auto space-y-1.5 overscroll-contain pr-0.5">
                  {filteredConversations.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted">
                      <p>未找到匹配的历史对话</p>
                    </div>
                  ) : (
                    filteredConversations.map((conv) => {
                      const isExpanded = expandedCardId === `${conv.cli}-${conv.id}`;
                      const conf = CLI_CONFIG[conv.cli] || {
                        icon: '🤖',
                        name: conv.cli,
                        color: 'text-text bg-panel2 border-border',
                      };

                      return (
                        <div
                          key={`${conv.cli}-${conv.id}`}
                          className="rounded-lg border border-border bg-panel p-2.5 transition-all text-xs hover:border-accent/40"
                        >
                          {/* Top Row: Software Badge + Relative Friendly Time */}
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${conf.color}`}
                            >
                              {conf.icon} {conf.name}
                            </span>
                            <span
                              className="text-[10px] text-muted font-mono"
                              title={`最后活跃：${formatExactDate(conv.updatedAt)}`}
                            >
                              {formatFriendlyTime(conv.updatedAt)}
                            </span>
                          </div>

                          {/* Card Content (Click to expand details) */}
                          <div
                            onClick={() =>
                              setExpandedCardId(isExpanded ? null : `${conv.cli}-${conv.id}`)
                            }
                            className="cursor-pointer"
                          >
                            <p className="font-semibold text-text leading-snug line-clamp-2 select-text mb-1">
                              {conv.title}
                            </p>
                            <p className="truncate text-[10px] text-muted font-mono">
                              📁 {conv.cwd}
                            </p>
                          </div>

                          {/* Expanded Details: Exact Timeline & Metadata */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-border/60 text-[11px] text-muted space-y-1.5">
                              {conv.firstPrompt && (
                                <div className="text-text/90 bg-panel2 p-2 rounded select-text break-words leading-relaxed">
                                  <span className="font-semibold text-accent block text-[10px] mb-0.5">
                                    💬 首次提问内容：
                                  </span>
                                  <p>{conv.firstPrompt}</p>
                                </div>
                              )}

                              {/* Exact Dates */}
                              <div className="rounded bg-panel2/60 p-2 space-y-1 text-[10px] font-mono text-muted">
                                <div className="flex items-center justify-between">
                                  <span>📅 发起时间:</span>
                                  <span className="text-text">{formatExactDate(conv.createdAt)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>🔄 最近活跃:</span>
                                  <span className="text-text">{formatExactDate(conv.updatedAt)}</span>
                                </div>
                                <div className="flex items-center justify-between pt-0.5 border-t border-border/40">
                                  <span>📊 对话轮次: {conv.messageCount ?? 1} 轮</span>
                                  <span>ID: {conv.id.slice(0, 10)}...</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Bottom Action Buttons */}
                          <div className="mt-2 flex items-center justify-between gap-2 pt-1.5 border-t border-border/40">
                            <button
                              onClick={() => void handleResume(conv)}
                              className="flex items-center gap-1 rounded bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25 active:bg-accent active:text-white transition-colors"
                            >
                              <span>🚀</span>
                              <span>恢复继续聊</span>
                            </button>

                            <button
                              onClick={() => void handleDeleteHistory(conv)}
                              className="flex items-center gap-1 rounded p-1 text-[11px] text-muted hover:text-red-400 hover:bg-red-500/10 active:text-red-400 transition-colors"
                              title="删除此存档"
                            >
                              <span>🗑️</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* =================================================================== */}
          {/* 3. 系统与偏好设置 (Settings Accordion) */}
          {/* =================================================================== */}
          <div className="rounded-xl border border-border bg-panel2/40 overflow-hidden shadow-sm">
            <button
              onClick={() => setOpenSettings(!openSettings)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold text-text hover:bg-panel2/80 active:bg-panel2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">⚙️</span>
                <span>系统与偏好设置</span>
              </div>
              <span className="text-xs text-muted">{openSettings ? '▾' : '▸'}</span>
            </button>

            {openSettings && (
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
                <div className="pt-2 border-t border-border/40 text-[10px] text-muted space-y-1 font-mono">
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
