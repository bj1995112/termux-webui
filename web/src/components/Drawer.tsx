import { useState, useEffect, useMemo } from 'react';
import { useDeck } from '../store.js';
import type { AgentConversation, CliId } from '@termux-webui/shared';
import { THEMES, type ThemeId } from '../theme.js';
import { getTerminalThemes, saveCustomTerminalTheme, deleteCustomTerminalTheme, exportTerminalTheme, type TerminalThemeConfig } from '../terminalTheme.js';
import { DictionaryManagerDialog } from './DictionaryManagerDialog.js';
import { ONLINE_TERMINAL_THEMES, downloadOnlineTerminalTheme } from '../onlineTerminalThemes.js';
import { TERMINAL_PROMPT_THEMES, TERMINAL_PROMPT_COLORS } from '../terminalPromptThemes.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onNewSession: () => void;
}

interface CustomKeyboardPage {
  id: string;
  label: string;
  keys: { label: string; seq: string }[];
}

const CUSTOM_KEYBOARD_STORAGE = 'twui.customKeyboardPages';
const readCustomKeyboardPages = (): CustomKeyboardPage[] => {
  try {
    const value = JSON.parse(localStorage.getItem(CUSTOM_KEYBOARD_STORAGE) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
};
const saveCustomKeyboardPages = (pages: CustomKeyboardPage[]) => {
  localStorage.setItem(CUSTOM_KEYBOARD_STORAGE, JSON.stringify(pages));
  window.dispatchEvent(new Event('twui-custom-keyboard-pages'));
};

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

const CLI_CONFIG: Record<string, { icon: string; name: string; gradient: string }> = {
  codex: {
    icon: '⚡',
    name: 'Codex',
    gradient: 'from-amber-500/20 to-orange-500/10 text-amber-300 border-amber-500/40',
  },
  pi: {
    icon: '🥧',
    name: 'Pi Agent',
    gradient: 'from-rose-500/20 to-pink-500/10 text-rose-300 border-rose-500/40',
  },
  agy: {
    icon: '🔮',
    name: 'Antigravity',
    gradient: 'from-cyan-500/20 to-blue-500/10 text-cyan-300 border-cyan-500/40',
  },
  claude: {
    icon: '🤖',
    name: 'Claude Code',
    gradient: 'from-purple-500/20 to-indigo-500/10 text-purple-300 border-purple-500/40',
  },
  opencode: {
    icon: '💻',
    name: 'OpenCode',
    gradient: 'from-blue-500/20 to-sky-500/10 text-blue-300 border-blue-500/40',
  },
  shell: {
    icon: '🐚',
    name: 'Shell',
    gradient: 'from-emerald-500/20 to-teal-500/10 text-emerald-300 border-emerald-500/40',
  },
};

export default function Drawer({ open, onClose, onNewSession }: Props) {
  const sessions = useDeck((s) => s.sessions);
  const activeId = useDeck((s) => s.activeId);
  const setActive = useDeck((s) => s.setActive);
  const killSession = useDeck((s) => s.killSession);
  const restartSession = useDeck((s) => s.restartSession);
  const conversations = useDeck((s) => s.conversations);
  const loadHistory = useDeck((s) => s.loadHistory);
  const resumeConversation = useDeck((s) => s.resumeConversation);
  const deleteHistory = useDeck((s) => s.deleteHistory);
  const loadConversationDetail = useDeck((s) => s.loadConversationDetail);
  const showToast = useDeck((s) => s.showToast);

  // Auth & Theme & Appearance & Translation
  const currentTheme = useDeck((s) => s.currentTheme);
  const setTheme = useDeck((s) => s.setTheme);
  const terminalTheme = useDeck((s) => s.terminalTheme);
  const setTerminalTheme = useDeck((s) => s.setTerminalTheme);
  const fontSize = useDeck((s) => s.fontSize);
  const resetFontSize = useDeck((s) => s.resetFontSize);
  const terminalLineHeight = useDeck((s) => s.terminalLineHeight);
  const setTerminalLineHeight = useDeck((s) => s.setTerminalLineHeight);
  const terminalCursorStyle = useDeck((s) => s.terminalCursorStyle);
  const setTerminalCursorStyle = useDeck((s) => s.setTerminalCursorStyle);
  const terminalCursorBlink = useDeck((s) => s.terminalCursorBlink);
  const setTerminalCursorBlink = useDeck((s) => s.setTerminalCursorBlink);
  const terminalPromptTheme = useDeck((s) => s.terminalPromptTheme);
  const setTerminalPromptTheme = useDeck((s) => s.setTerminalPromptTheme);
  const terminalPromptColor = useDeck((s) => s.terminalPromptColor);
  const setTerminalPromptColor = useDeck((s) => s.setTerminalPromptColor);
  const translationConfig = useDeck((s) => s.translationConfig);
  const setTranslationConfig = useDeck((s) => s.setTranslationConfig);
  const logout = useDeck((s) => s.logout);

  // Terminal preferences
  const followOutput = useDeck((s) => s.followOutput);
  const toggleFollowOutput = useDeck((s) => s.toggleFollowOutput);
  const suppressKeyboard = useDeck((s) => s.suppressKeyboard);
  const toggleSuppressKeyboard = useDeck((s) => s.toggleSuppressKeyboard);

  // Accordion state
  const [openActive, setOpenActive] = useState(true);
  const [openHistory, setOpenHistory] = useState(false);
  const [openTheme, setOpenTheme] = useState(false);
  const [openTerminalTheme, setOpenTerminalTheme] = useState(false);
  const [terminalThemes, setTerminalThemes] = useState<TerminalThemeConfig[]>(getTerminalThemes);
  const [openSettings, setOpenSettings] = useState(false);
  const [openDictManager, setOpenDictManager] = useState(false);
  const [customKeyboardPages, setCustomKeyboardPages] = useState<CustomKeyboardPage[]>(readCustomKeyboardPages);

  // History filtering & search
  const [activeCliFilter, setActiveCliFilter] = useState<'all' | CliId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testingApi, setTestingApi] = useState(false);

  useEffect(() => {
    if (open) {
      void loadHistory();
    }
  }, [open, loadHistory]);

  const refreshTerminalThemes = () => setTerminalThemes(getTerminalThemes());
  const [onlineDownloading, setOnlineDownloading] = useState<string | null>(null);
  const [openOnlineThemes, setOpenOnlineThemes] = useState(false);
  const [onlineThemeQuery, setOnlineThemeQuery] = useState('');
  const [onlineThemeCategory, setOnlineThemeCategory] = useState<'all' | 'dark' | 'light'>('all');
  const filteredOnlineThemes = useMemo(() => {
    const q = onlineThemeQuery.trim().toLowerCase();
    return ONLINE_TERMINAL_THEMES.filter((meta) => {
      if (q && !`${meta.name} ${meta.description ?? ''}`.toLowerCase().includes(q)) return false;
      if (onlineThemeCategory === 'dark' && /light|day|pastel/i.test(meta.name)) return false;
      if (onlineThemeCategory === 'light' && !/light|day|pastel/i.test(meta.name)) return false;
      return true;
    });
  }, [onlineThemeQuery, onlineThemeCategory]);

  const installOnlineTheme = async (meta: typeof ONLINE_TERMINAL_THEMES[number]) => {
    if (onlineDownloading) return;
    setOnlineDownloading(meta.id);
    try {
      const theme = await downloadOnlineTerminalTheme(meta);
      saveCustomTerminalTheme(theme);
      refreshTerminalThemes();
      setTerminalTheme(theme.id);
      showToast(`${meta.name} 已下载并应用`, 'success');
    } catch (e) {
      console.error(e);
      showToast(`${meta.name} 下载失败，请检查网络`, 'error');
    } finally { setOnlineDownloading(null); }
  };

  const importTerminalTheme = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<TerminalThemeConfig>;
      if (!parsed.name || !parsed.terminal || typeof parsed.terminal.background !== 'string' || typeof parsed.terminal.foreground !== 'string') {
        throw new Error('invalid theme');
      }
      const id = String(parsed.id || `custom-${Date.now()}`).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
      if (!id || terminalThemes.some((t) => t.builtIn && t.id === id)) throw new Error('invalid id');
      saveCustomTerminalTheme({ id, name: parsed.name, nameEn: parsed.nameEn, badge: parsed.badge || '🎨', description: parsed.description || '用户自定义终端主题', terminal: parsed.terminal, builtIn: false });
      refreshTerminalThemes();
      setTerminalTheme(id);
      showToast('终端主题已导入', 'success');
    } catch {
      showToast('主题文件无效，导入失败', 'error');
    }
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
    } catch {
      /* handled in store */
    }
  };

  const handleViewDetail = async (conv: AgentConversation) => {
    await loadConversationDetail(conv.cli, conv.id);
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
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
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
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5 bg-panel2/50 backdrop-blur-md">
          <div>
            <p className="text-base font-bold text-accent">▚ Termux WebUI</p>
            <p className="text-[11px] text-muted">移动端 AI Agent 统一调度中枢</p>
          </div>
          <button
            onClick={handleNewSession}
            className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-md active:bg-accent-hover transition-all"
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
                <span>当前运行终端</span>
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
                    const isExited = s.status === 'exited';
                    const conf = CLI_CONFIG[s.kind] || { icon: '🐚', name: s.kind, gradient: '' };
                    return (
                      <div
                        key={s.id}
                        onClick={() => selectSession(s.id)}
                        className={`group flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition-all cursor-pointer ${
                          isCur
                            ? 'border-accent bg-accent/15 shadow-sm'
                            : 'border-border bg-panel hover:bg-panel2 active:bg-panel2'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span
                            className={`h-2 w-2 flex-shrink-0 rounded-full ${
                              isExited
                                ? 'bg-amber-400'
                                : isCur
                                ? 'bg-accent animate-pulse'
                                : 'bg-emerald-400'
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
                              {isExited && (
                                <span className="rounded bg-amber-400/20 px-1 text-[9px] font-semibold text-amber-400">
                                  已退出
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[10px] text-muted font-mono">
                              {s.cwd || '~'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isExited && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void restartSession(s.id);
                              }}
                              className="rounded p-1 text-accent hover:bg-accent/15 active:scale-95"
                              title="重启终端"
                            >
                              🔄
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void killSession(s.id);
                            }}
                            className="rounded p-1 text-muted hover:text-red-400 hover:bg-red-500/10 active:text-red-400"
                            title="关闭会话"
                          >
                            ✕
                          </button>
                        </div>
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
            <div className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-bold text-text hover:bg-panel2/80 active:bg-panel2">
              <div
                onClick={() => setOpenHistory(!openHistory)}
                className="flex items-center gap-2 cursor-pointer flex-1"
              >
                <span className="text-sm">📚</span>
                <span>AI 历史对话中枢</span>
                <span className="rounded-full bg-border px-1.5 py-0.2 text-[10px] font-semibold text-muted">
                  {conversations.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRefreshing(true);
                    void loadHistory().finally(() => setTimeout(() => setIsRefreshing(false), 400));
                  }}
                  className={`p-1 rounded text-muted hover:text-text hover:bg-panel active:text-accent transition-transform ${
                    isRefreshing ? 'animate-spin text-accent' : ''
                  }`}
                  title="立即刷新历史列表"
                >
                  🔄
                </button>
                <span
                  onClick={() => setOpenHistory(!openHistory)}
                  className="text-xs text-muted cursor-pointer px-1"
                >
                  {openHistory ? '▾' : '▸'}
                </span>
              </div>
            </div>

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
                <div className="max-h-[340px] overflow-y-auto space-y-2 overscroll-contain pr-0.5">
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
                        gradient: 'from-blue-500/20 to-sky-500/10 text-blue-300 border-blue-500/40',
                      };

                      return (
                        <div
                          key={`${conv.cli}-${conv.id}`}
                          className="rounded-xl border border-border bg-panel p-3 transition-all text-xs hover:border-accent/40 shadow-sm"
                        >
                          {/* Top Row: Software Gradient Badge + Relative Friendly Time */}
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <span
                              className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border bg-gradient-to-r ${conf.gradient}`}
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

                          {/* Card Content (Click to toggle expanded metadata) */}
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
                                <div className="text-text/90 bg-panel2 p-2.5 rounded-lg select-text break-words leading-relaxed border border-border/40">
                                  <span className="font-semibold text-accent block text-[10px] mb-0.5">
                                    💬 首次提问内容：
                                  </span>
                                  <p>{conv.firstPrompt}</p>
                                </div>
                              )}

                              {/* Exact Dates */}
                              <div className="rounded-lg bg-panel2/60 p-2 space-y-1 text-[10px] font-mono text-muted border border-border/30">
                                <div className="flex items-center justify-between">
                                  <span>📅 发起时间:</span>
                                  <span className="text-text">{formatExactDate(conv.createdAt)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>🔄 最近活跃:</span>
                                  <span className="text-text">{formatExactDate(conv.updatedAt)}</span>
                                </div>
                                <div className="flex items-center justify-between pt-0.5 border-t border-border/40">
                                  <span>📊 轮次: {conv.messageCount ?? 1} 轮</span>
                                  <span>ID: {conv.id.slice(0, 10)}...</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Bottom Action Buttons */}
                          <div className="mt-2.5 flex items-center justify-between gap-1.5 pt-2 border-t border-border/40">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => void handleResume(conv)}
                                className="flex items-center gap-1 rounded-lg bg-accent/20 border border-accent/40 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent hover:text-white active:scale-95 transition-all"
                              >
                                <span>🚀</span>
                                <span>恢复继续聊</span>
                              </button>

                              <button
                                onClick={() => void handleViewDetail(conv)}
                                className="flex items-center gap-1 rounded-lg border border-border bg-panel2 px-2 py-1 text-[11px] text-muted hover:text-text active:scale-95 transition-all"
                                title="查看对话只读记录"
                              >
                                <span>📖</span>
                                <span>看记录</span>
                              </button>
                            </div>

                            <button
                              onClick={() => void handleDeleteHistory(conv)}
                              className="flex items-center gap-1 rounded-lg p-1 text-[11px] text-muted hover:text-red-400 hover:bg-red-500/10 active:text-red-400 transition-colors"
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
          {/* 3. WebUI 主题 */}
          {/* =================================================================== */}
          <div className="rounded-xl border border-border bg-panel2/40 overflow-hidden shadow-sm">
            <button
              onClick={() => setOpenTheme(!openTheme)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold text-text hover:bg-panel2/80 active:bg-panel2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🎨</span>
                <span>精选大师级主题</span>
                <span className="rounded-full bg-accent/20 px-1.5 py-0.2 text-[10px] font-semibold text-accent">
                  {THEMES[currentTheme]?.name.split(' ')[0]}
                </span>
              </div>
              <span className="text-xs text-muted">{openTheme ? '▾' : '▸'}</span>
            </button>

            {openTheme && (
              <div className="border-t border-border/60 p-2.5 space-y-2">
                {(Object.keys(THEMES) as ThemeId[]).map((tid) => {
                  const t = THEMES[tid];
                  const isCurrent = tid === currentTheme;
                  return (
                    <div
                      key={tid}
                      onClick={() => setTheme(tid)}
                      className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition-all ${
                        isCurrent
                          ? 'border-accent bg-accent/15 shadow-sm glow-accent'
                          : 'border-border bg-panel hover:bg-panel2'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold border border-border/60"
                          style={{ background: t.vars['--bg-panel'], color: t.vars['--accent'] }}
                        >
                          {t.badge}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text">{t.name}</p>
                          <p className="text-[10px] text-muted">{t.description}</p>
                        </div>
                      </div>

                      {isCurrent && (
                        <span className="text-xs text-accent font-bold">✓ 当前</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* =================================================================== */}
          {/* 4. 独立终端主题 */}
          {/* =================================================================== */}
          <div className="rounded-xl border border-border bg-panel2/40 overflow-hidden shadow-sm">
            <button onClick={() => setOpenTerminalTheme(!openTerminalTheme)} className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold text-text hover:bg-panel2/80 active:bg-panel2">
              <div className="flex items-center gap-2">
                <span className="text-sm">⌨️</span><span>终端主题</span>
                <span className="rounded-full bg-accent/20 px-1.5 py-0.2 text-[10px] font-semibold text-accent">{terminalThemes.find((t) => t.id === terminalTheme)?.name || 'Termux 经典'}</span>
              </div>
              <span className="text-xs text-muted">{openTerminalTheme ? '▾' : '▸'}</span>
            </button>
            {openTerminalTheme && (
              <div className="border-t border-border/60 p-2.5 space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  {terminalThemes.map((t) => {
                    const active = t.id === terminalTheme;
                    const fg = t.terminal.foreground || '#fff';
                    const bg = t.terminal.background || '#000';
                    return (
                      <div key={t.id} className={`overflow-hidden rounded-xl border transition-all ${active ? 'border-accent ring-1 ring-accent/30' : 'border-border'}`}>
                        <button type="button" className="block w-full text-left" onClick={() => setTerminalTheme(t.id)}>
                          <div className="px-2.5 pt-2">
                            <div className="relative overflow-hidden rounded-lg border border-white/10 px-2.5 py-2 font-mono text-[10px] leading-[1.55]" style={{ background: bg, color: fg }}>
                              <div><span style={{ color: t.terminal.green }}>$</span> <span>cd ~/AI</span></div>
                              <div><span style={{ color: t.terminal.cyan }}>~/AI</span> <span style={{ color: t.terminal.blue }}>❯</span> <span>npm run dev</span></div>
                              <div><span style={{ color: t.terminal.green }}>✓</span> <span>Server started</span> <span style={{ color: t.terminal.yellow }}>:4096</span></div>
                              <div><span style={{ color: t.terminal.magenta }}>终端主题预览</span> <span style={{ color: t.terminal.red }}>错误</span> <span style={{ color: t.terminal.yellow }}>警告</span></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-2.5 py-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 text-sm" style={{ background: bg, color: t.terminal.cursor || fg }}>{t.badge}</span>
                            <div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-text truncate">{t.name}</p><p className="text-[9px] text-muted truncate">{t.description}</p></div>
                            {active && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold text-accent">✓ 当前</span>}
                          </div>
                        </button>
                        <div className="flex items-center gap-3 border-t border-border/50 px-2.5 py-1.5 text-[9px]">
                          <span style={{ color: t.terminal.red }}>红</span><span style={{ color: t.terminal.green }}>绿</span><span style={{ color: t.terminal.yellow }}>黄</span><span style={{ color: t.terminal.blue }}>蓝</span><span style={{ color: t.terminal.magenta }}>紫</span><span style={{ color: t.terminal.cyan }}>青</span>
                          {!t.builtIn && <><button type="button" onClick={() => exportTerminalTheme(t)} className="ml-auto text-accent">导出</button><button type="button" onClick={() => { deleteCustomTerminalTheme(t.id); refreshTerminalThemes(); }} className="text-red-400">删除</button></>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setOpenOnlineThemes(!openOnlineThemes)} className="flex w-full items-center justify-between rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-left hover:bg-accent/10">
                  <span className="text-[11px] font-semibold text-accent">在线主题库</span>
                  <span className="text-[10px] text-muted">{openOnlineThemes ? '收起 ▾' : `${ONLINE_TERMINAL_THEMES.length} 个可下载 ▸`}</span>
                </button>
                {openOnlineThemes && (
                  <div className="space-y-2 rounded-lg border border-border/60 bg-panel/50 p-1.5">
                    <p className="px-1 py-0.5 text-[9px] leading-4 text-muted">来自 iTerm2 Color Schemes 的 Termux 原生配色，只下载颜色配置，不执行脚本。</p>
                    <input value={onlineThemeQuery} onChange={(e) => setOnlineThemeQuery(e.target.value)} placeholder="搜索主题名称…" className="w-full rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-[10px] text-text outline-none focus:border-accent" />
                    <div className="flex gap-1">
                      {([['all','全部'], ['dark','深色'], ['light','浅色']] as const).map(([id,label]) => <button key={id} type="button" onClick={() => setOnlineThemeCategory(id)} className={`rounded-md px-2 py-1 text-[9px] ${onlineThemeCategory === id ? 'bg-accent/15 text-accent font-semibold' : 'text-muted hover:bg-panel2'}`}>{label}</button>)}
                      <span className="ml-auto self-center text-[9px] text-muted">{filteredOnlineThemes.length} 个</span>
                    </div>
                    {filteredOnlineThemes.map((meta) => {

                      const installed = terminalThemes.some((t) => t.id === `online-${meta.id}`);
                      const downloading = onlineDownloading === meta.id;
                      return <div key={meta.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-panel2">
                        <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-text">{meta.name}</p><p className="truncate text-[9px] text-muted">{meta.description}</p></div>
                        <button type="button" disabled={!!onlineDownloading} onClick={() => void installOnlineTheme(meta)} className="shrink-0 rounded-md border border-accent/40 px-2 py-1 text-[9px] font-semibold text-accent disabled:opacity-50">{downloading ? '下载中…' : installed ? '重新应用' : '下载并应用'}</button>
                      </div>;
                    })}
                  </div>
                )}
                <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-accent/40 bg-accent/5 px-3 py-2 text-[11px] font-semibold text-accent hover:bg-accent/10">
                  ＋ 导入终端主题 JSON
                  <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void importTerminalTheme(e.target.files?.[0]); e.currentTarget.value = ''; }} />
                </label>
                <p className="text-[9px] leading-4 text-muted">终端主题已与 WebUI 主题分离。现有字体、字号、双指缩放和终端操作保持独立。</p>
              </div>
            )}
          </div>

          {/* =================================================================== */}
          {/* 5. 系统与偏好设置 (Settings Accordion) */}
          {/* =================================================================== */}
          <div className="rounded-xl border border-border bg-panel2/40 overflow-hidden shadow-sm">
            <button
              onClick={() => setOpenSettings(!openSettings)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold text-text hover:bg-panel2/80 active:bg-panel2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">⚙️</span>
                <span>系统偏好与安全</span>
              </div>
              <span className="text-xs text-muted">{openSettings ? '▾' : '▸'}</span>
            </button>

            {openSettings && (
              <div className="border-t border-border/60 p-3 space-y-3 text-xs">
                {/* 快捷命令页 */}
                <div className="space-y-2 rounded-lg border border-accent/20 bg-accent/5 p-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-text font-medium block">⌨️ 快捷命令页</span>
                      <span className="text-[10px] text-muted block">管理键盘第 5 页起的自定义页面；前 4 页固定不变</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const label = window.prompt('新快捷命令页名称', `自定义 ${customKeyboardPages.length + 1}`)?.trim();
                        if (!label) return;
                        const pages = [...customKeyboardPages, { id: `custom-${Date.now()}`, label, keys: [] }];
                        setCustomKeyboardPages(pages);
                        saveCustomKeyboardPages(pages);
                      }}
                      className="rounded-md border border-accent/40 bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent active:scale-95"
                    >
                      ＋ 新增
                    </button>
                  </div>

                  {customKeyboardPages.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-2 text-[10px] text-muted text-center">
                      暂无自定义页。新增后会从键盘第 5 页开始显示。
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {customKeyboardPages.map((page, index) => (
                        <div key={page.id} className="rounded-md border border-border bg-panel p-2 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 text-center text-[10px] text-muted">{index + 5}</span>
                            <span className="min-w-0 flex-1 truncate font-medium text-text">{page.label}</span>
                            <button type="button" onClick={() => {
                              const label = window.prompt('修改页面名称', page.label)?.trim();
                              if (!label) return;
                              const pages = customKeyboardPages.map((p) => p.id === page.id ? { ...p, label } : p);
                              setCustomKeyboardPages(pages); saveCustomKeyboardPages(pages);
                            }} className="px-1.5 py-0.5 text-[10px] text-accent">改名</button>
                            <button type="button" onClick={() => {
                              if (!window.confirm(`删除“${page.label}”？`)) return;
                              const pages = customKeyboardPages.filter((p) => p.id !== page.id);
                              setCustomKeyboardPages(pages); saveCustomKeyboardPages(pages);
                            }} className="px-1.5 py-0.5 text-[10px] text-red-400">删除</button>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {page.keys.map((k, ki) => (
                              <button key={`${page.id}-${ki}`} type="button" title={k.seq} onClick={() => {
                                const label = window.prompt('按钮名称', k.label)?.trim();
                                if (!label) return;
                                const seq = window.prompt('发送内容（支持\x1b 等终端控制序列）', k.seq);
                                if (seq === null) return;
                                const pages = customKeyboardPages.map((p) => p.id === page.id ? { ...p, keys: p.keys.map((x, i) => i === ki ? { label, seq } : x) } : p);
                                setCustomKeyboardPages(pages); saveCustomKeyboardPages(pages);
                              }} className="truncate rounded border border-border px-1.5 py-1 text-[10px] text-text text-left">
                                {k.label}
                              </button>
                            ))}
                          </div>
                          {page.keys.length < 14 && (
                            <button type="button" onClick={() => {
                              const label = window.prompt('按钮名称');
                              if (!label?.trim()) return;
                              const seq = window.prompt('发送内容', label);
                              if (seq === null) return;
                              const pages = customKeyboardPages.map((p) => p.id === page.id ? { ...p, keys: [...p.keys, { label: label.trim(), seq }] } : p);
                              setCustomKeyboardPages(pages); saveCustomKeyboardPages(pages);
                            }} className="w-full rounded border border-dashed border-border px-2 py-1 text-[10px] text-muted hover:text-accent">
                              ＋ 添加按键（{page.keys.length}/14）
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] leading-relaxed text-muted">自定义页最多 14 个按键，按两行自动排列。左右滑动键盘切页；删除页面不会影响前 4 个固定页面。</p>
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
                    <span className="text-[10px] text-muted block">点击终端时默认不弹出手机输入法</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={suppressKeyboard}
                    onChange={(e) => toggleSuppressKeyboard(e.target.checked)}
                    className="h-4 w-4 accent-accent rounded"
                  />
                </label>

                {/* 终端外观 */}
                <div className="space-y-2 rounded-lg border border-border/60 bg-panel/60 p-2.5">
                  <div>
                    <span className="text-text font-medium block">终端外观</span>
                    <span className="text-[10px] text-muted block">独立于 WebUI 主题；适合手机终端阅读</span>
                  </div>
                  <div className="space-y-1.5 rounded-md border border-accent/20 bg-accent/5 p-2">
                    <div>
                      <span className="text-[10px] text-text font-medium block">命令行样式</span>
                      <span className="text-[9px] text-muted block">改变 Prompt 本身；命令会自然出现在箭头后面</span>
                    </div>
                    <select value={terminalPromptTheme} onChange={(e) => setTerminalPromptTheme(e.target.value)} className="w-full rounded-md border border-border bg-panel2 px-2 py-1.5 text-[10px] text-text">
                      {TERMINAL_PROMPT_THEMES.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.sample.replace(/\n/g, ' / ')}</option>)}
                    </select>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-muted">命令行颜色</span>
                        <span className="text-[9px] font-medium" style={{ color: TERMINAL_PROMPT_COLORS.find((c) => c.id === terminalPromptColor)?.hex || '#00d7ff' }}>{TERMINAL_PROMPT_COLORS.find((c) => c.id === terminalPromptColor)?.name || '青色'}</span>
                      </div>
                      <div className="grid grid-cols-9 gap-1">
                        {TERMINAL_PROMPT_COLORS.map((c) => {
                          const active = terminalPromptColor === c.id;
                          return <button key={c.id} type="button" title={c.name} aria-label={`命令行颜色：${c.name}`} onClick={() => setTerminalPromptColor(c.id)} className={`h-6 rounded-md border transition-all ${active ? 'border-white ring-1 ring-accent scale-105' : 'border-border/60'}`} style={{ background: c.hex }} />;
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted">光标样式</span>
                    <select value={terminalCursorStyle} onChange={(e) => setTerminalCursorStyle(e.target.value as 'block' | 'underline' | 'bar')} className="rounded-md border border-border bg-panel2 px-2 py-1 text-[10px] text-text">
                      <option value="block">方块</option><option value="bar">竖线</option><option value="underline">下划线</option>
                    </select>
                  </div>
                  <label className="flex items-center justify-between">
                    <span className="text-[10px] text-muted">光标闪烁</span>
                    <input type="checkbox" checked={terminalCursorBlink} onChange={(e) => setTerminalCursorBlink(e.target.checked)} className="h-4 w-4 accent-accent rounded" />
                  </label>
                  <div>
                    <div className="mb-1 flex items-center justify-between"><span className="text-[10px] text-muted">行距</span><span className="text-[10px] font-mono text-text">{terminalLineHeight.toFixed(2)}</span></div>
                    <input type="range" min="1" max="2" step="0.05" value={terminalLineHeight} onChange={(e) => setTerminalLineHeight(Number(e.target.value))} className="w-full accent-accent" />
                  </div>
                </div>

                {/* 终端字体大小与重置 */}
                <div className="flex items-center justify-between py-0.5">
                  <div>
                    <span className="text-text font-medium block">终端字体大小</span>
                    <span className="text-[10px] text-muted block">当前: {fontSize}px (双指捏合可缩放 6~36px)</span>
                  </div>
                  {fontSize !== 13 && (
                    <button
                      onClick={() => resetFontSize()}
                      className="rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent active:scale-95 transition-all"
                    >
                      重置 13px
                    </button>
                  )}
                </div>

                {/* 🌐 翻译引擎配置 */}
                <div className="pt-2 border-t border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-text font-medium block">🌐 翻译引擎配置</span>
                      <span className="text-[10px] text-muted block">支持自动多源故障转移与自定义大模型</span>
                    </div>
                  </div>

                  {/* 引擎提供商选择 */}
                  <select
                    value={translationConfig.provider}
                    onChange={(e) =>
                      setTranslationConfig({
                        provider: e.target.value as any,
                      })
                    }
                    className="w-full rounded-lg border border-border bg-panel2 px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
                  >
                    <option value="auto">🔄 自动多源故障转移 (Google + Lingva，推荐免Key)</option>
                    <option value="google">🌐 Google 官方 Web 翻译通道</option>
                    <option value="lingva">🌍 Lingva 开源镜像通道</option>
                    <option value="custom_llm">🤖 自定义大模型 API (DeepSeek / OpenAI / Ollama)</option>
                  </select>

                  {/* 自定义大模型参数配置 */}
                  {translationConfig.provider === 'custom_llm' && (
                    <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-2.5 text-xs animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-accent">大模型参数配置</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTranslationConfig({
                              customBaseUrl: 'https://api.deepseek.com/v1',
                              customModel: 'deepseek-chat',
                            });
                            showToast('已填入 DeepSeek 官方默认地址与模型', 'info');
                          }}
                          className="text-[10px] text-accent underline hover:text-accent-hover"
                        >
                          一键填入 DeepSeek 预设
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] text-muted mb-0.5">Base URL (API 根地址):</label>
                        <input
                          type="text"
                          value={translationConfig.customBaseUrl || ''}
                          placeholder="例如: https://api.deepseek.com/v1"
                          onChange={(e) =>
                            setTranslationConfig({ customBaseUrl: e.target.value })
                          }
                          className="w-full rounded border border-border bg-panel px-2 py-1 text-[11px] text-text font-mono focus:border-accent focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-muted mb-0.5">API Key (令牌密钥):</label>
                        <input
                          type="password"
                          value={translationConfig.customApiKey || ''}
                          placeholder="sk-..."
                          onChange={(e) =>
                            setTranslationConfig({ customApiKey: e.target.value })
                          }
                          className="w-full rounded border border-border bg-panel px-2 py-1 text-[11px] text-text font-mono focus:border-accent focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-muted mb-0.5">Model (模型名称):</label>
                        <input
                          type="text"
                          value={translationConfig.customModel || ''}
                          placeholder="例如: deepseek-chat 或 gpt-4o-mini"
                          onChange={(e) =>
                            setTranslationConfig({ customModel: e.target.value })
                          }
                          className="w-full rounded border border-border bg-panel px-2 py-1 text-[11px] text-text font-mono focus:border-accent focus:outline-none"
                        />
                      </div>

                      <div className="pt-1 flex items-center justify-end">
                        <button
                          type="button"
                          disabled={testingApi}
                          onClick={async () => {
                            setTestingApi(true);
                            showToast('正在测试 API 连通性...', 'info');
                            try {
                              const token = localStorage.getItem('twui.token');
                              const res = await fetch('/api/translate', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  text: 'Hello from Termux WebUI',
                                  to: 'zh-CN',
                                  config: translationConfig,
                                }),
                              });
                              const data = await res.json();
                              if (data.ok && data.translated) {
                                showToast(`✅ API 测试通过！响应: ${data.translated}`, 'success');
                              } else {
                                showToast(`❌ API 测试失败: ${data.error || '无法获取响应'}`, 'error');
                              }
                            } catch (e) {
                              showToast(`❌ 请求异常: ${e instanceof Error ? e.message : String(e)}`, 'error');
                            } finally {
                              setTestingApi(false);
                            }
                          }}
                          className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1 text-[11px] font-semibold text-white active:scale-95 transition-all disabled:opacity-50"
                        >
                          <span>{testingApi ? '⏳' : '🧪'}</span>
                          <span>{testingApi ? '测试中...' : '测试 API 连通性'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {/* 🚀 AI 命令工坊 (Command Studio) 入口 */}
                  <div className="pt-2 border-t border-border/40">
                    <button
                      type="button"
                      onClick={() => setOpenDictManager(true)}
                      className="flex w-full items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/20 active:scale-95 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🚀</span>
                        <span>AI 命令工坊 (Command Studio)</span>
                      </div>
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">
                        全套斜杠命令 / 源码挖掘
                      </span>
                    </button>
                  </div>
                </div>

                {/* 登出 / 锁定 */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <div>
                    <span className="text-text font-medium block">会话安全锁</span>
                    <span className="text-[10px] text-muted block">退出当前登录认证 (密码: 000000)</span>
                  </div>
                  <button
                    onClick={() => {
                      close();
                      void logout();
                    }}
                    className="rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/25 active:scale-95"
                  >
                    🔒 锁定 / 登出
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 📚 独立编程词典与自学习管理弹窗 */}
      <DictionaryManagerDialog open={openDictManager} onClose={() => setOpenDictManager(false)} />
    </div>
  );
}
