import { useState, useEffect, useMemo } from 'react';
import { useDeck } from '../store.js';

interface CustomSource {
  id: string;
  name: string;
  url: string;
  description?: string;
  lastScannedAt?: number;
}

interface LearnedEntry {
  original: string;
  translated: string;
  timestamp?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DictionaryManagerDialog({ open, onClose }: Props) {
  const [tab, setTab] = useState<'commands' | 'sources' | 'miner' | 'learned'>('commands');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    lastSyncTime?: number;
    entryCount?: number;
    version?: string;
    sources?: CustomSource[];
  }>({});

  const [learnedList, setLearnedList] = useState<LearnedEntry[]>([]);

  // Add command state
  const [newCmd, setNewCmd] = useState('');
  const [newZh, setNewZh] = useState('');

  // Add source state
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');

  // Miner state
  const [minerText, setMinerText] = useState('');
  const [mining, setMining] = useState(false);
  const [minedResults, setMinedResults] = useState<Array<{ cmd: string; zh: string }>>([]);

  const showToast = useDeck((s) => s.showToast);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/dictionary/sync-status');
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
      }
    } catch {
      /* ignore */
    }
  };

  const fetchLearned = async () => {
    try {
      const res = await fetch('/api/dictionary/learned');
      if (res.ok) {
        const data = (await res.json()) as LearnedEntry[];
        if (Array.isArray(data)) {
          setLearnedList(data);
        }
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (open) {
      void fetchLearned();
      void fetchStatus();
    }
  }, [open]);

  // One-click incremental sync
  const handleSyncLatest = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/dictionary/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || '同步完成');
        void fetchStatus();
        void fetchLearned();
      } else {
        showToast('同步失败，请检查网络');
      }
    } catch {
      showToast('网络连接超时');
    } finally {
      setSyncing(false);
    }
  };

  // Add custom command
  const handleAddCommand = async () => {
    const cmd = newCmd.trim();
    const zh = newZh.trim();
    if (!cmd || !zh) {
      showToast('请完整输入命令与中文释义');
      return;
    }
    const fullCmd = cmd.startsWith('/') ? cmd : `/${cmd}`;
    const fullZh = `${fullCmd} ${zh}`;
    try {
      const res = await fetch('/api/dictionary/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original: fullCmd, translated: fullZh }),
      });
      if (res.ok) {
        setNewCmd('');
        setNewZh('');
        showToast(`✅ 成功添加命令：${fullCmd}`);
        void fetchLearned();
        void fetchStatus();
      }
    } catch {
      showToast('添加失败');
    }
  };

  // Add source repo
  const handleAddSource = async () => {
    if (!newSourceName.trim() || !newSourceUrl.trim()) {
      showToast('请完整填写仓库名称与地址');
      return;
    }
    try {
      const res = await fetch('/api/commands/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSourceName.trim(), url: newSourceUrl.trim() }),
      });
      if (res.ok) {
        showToast('✅ 成功添加源码监控仓库');
        setNewSourceName('');
        setNewSourceUrl('');
        void fetchStatus();
      }
    } catch {
      showToast('添加失败');
    }
  };

  // Delete source repo
  const handleDeleteSource = async (id: string) => {
    try {
      const res = await fetch(`/api/commands/sources/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('已移除仓库');
        void fetchStatus();
      }
    } catch {
      showToast('移除失败');
    }
  };

  // Delete learned entry
  const handleDeleteLearned = async (orig: string) => {
    try {
      const res = await fetch('/api/dictionary/entry', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original: orig }),
      });
      if (res.ok) {
        showToast('已删除词条');
        void fetchLearned();
        void fetchStatus();
      }
    } catch {
      showToast('删除失败');
    }
  };

  // Mine commands from text
  const handleMine = async () => {
    if (!minerText.trim()) {
      showToast('请粘贴包含斜杠命令的源码或文档');
      return;
    }
    setMining(true);
    try {
      const res = await fetch('/api/commands/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: minerText }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.added)) {
        setMinedResults(data.added);
        showToast(`🎉 成功萃取并自动汉化收录了 ${data.added.length} 条全新命令！`);
        void fetchStatus();
        void fetchLearned();
      }
    } catch {
      showToast('解析失败');
    } finally {
      setMining(false);
    }
  };

  const filteredLearned = useMemo(() => {
    if (!search.trim()) return learnedList;
    const q = search.toLowerCase();
    return learnedList.filter(
      (e) => e.original.toLowerCase().includes(q) || e.translated.toLowerCase().includes(q),
    );
  }, [learnedList, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="flex h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-panel text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚀</span>
            <div>
              <h2 className="text-base font-bold tracking-wide">AI 命令工坊 (Command Studio)</h2>
              <p className="text-[11px] text-muted">
                {syncStatus.entryCount ?? 0} 条标准命令 · 聚焦 Top 6 AI CLI · 0ms 流式秒翻
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleSyncLatest()}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 hover:bg-accent hover:text-white transition disabled:opacity-50"
              title="一键联网检测官方是否有新命令并自动增量同步"
            >
              <span className={syncing ? 'animate-spin' : ''}>🔄</span>
              <span>{syncing ? '检测同步中...' : '一键增量同步'}</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-white transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-black/20 px-4 pt-2 gap-2 text-xs">
          <button
            onClick={() => setTab('commands')}
            className={`pb-2.5 px-3 font-medium border-b-2 transition ${
              tab === 'commands'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            ⚡ 命令速查 & 添加
          </button>
          <button
            onClick={() => setTab('sources')}
            className={`pb-2.5 px-3 font-medium border-b-2 transition ${
              tab === 'sources'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            🌐 源码仓库源 ({syncStatus.sources?.length ?? 0})
          </button>
          <button
            onClick={() => setTab('miner')}
            className={`pb-2.5 px-3 font-medium border-b-2 transition ${
              tab === 'miner'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            🔍 源码命令挖掘器
          </button>
          <button
            onClick={() => setTab('learned')}
            className={`pb-2.5 px-3 font-medium border-b-2 transition ${
              tab === 'learned'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            🧠 自动发现库 ({learnedList.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: Commands */}
          {tab === 'commands' && (
            <div className="space-y-4">
              {/* Quick Add Form */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-accent flex items-center gap-1.5">
                  <span>➕</span>
                  <span>添加自定义斜杠命令</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="命令名 (例如 /mycmd)"
                    value={newCmd}
                    onChange={(e) => setNewCmd(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-accent focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="标准中文释义 (例如 执行自定义自动化流程)"
                    value={newZh}
                    onChange={(e) => setNewZh(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => void handleAddCommand()}
                    className="rounded-lg bg-accent px-4 py-1 text-xs font-medium text-white hover:bg-accent-hover transition shadow"
                  >
                    保存命令
                  </button>
                </div>
              </div>

              {/* Supported Tools Preset Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.01]">
                  <div className="font-semibold text-cyan-400">🤖 OpenAI Codex</div>
                  <div className="text-[11px] text-muted mt-0.5">/plan, /goal, /agents, /side, /copy, /export, /skills...</div>
                </div>
                <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.01]">
                  <div className="font-semibold text-amber-400">⚡ Claude Code</div>
                  <div className="text-[11px] text-muted mt-0.5">/compact, /context, /resume, /fork, /rewind, /btw...</div>
                </div>
                <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.01]">
                  <div className="font-semibold text-emerald-400">🛠️ Aider Pair</div>
                  <div className="text-[11px] text-muted mt-0.5">/add, /drop, /ls, /map, /code, /ask, /architect...</div>
                </div>
                <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.01]">
                  <div className="font-semibold text-blue-400">🎯 Cursor CLI</div>
                  <div className="text-[11px] text-muted mt-0.5">/edit, /connect, /debug, /rename, /summarize, /rules...</div>
                </div>
                <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.01]">
                  <div className="font-semibold text-purple-400">💡 OpenCode</div>
                  <div className="text-[11px] text-muted mt-0.5">/editor, /session, /switch, /attach, /history, /prune...</div>
                </div>
                <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.01]">
                  <div className="font-semibold text-pink-400">⚙️ 脚手架 & 环境</div>
                  <div className="text-[11px] text-muted mt-0.5">Create-Vite, Next, Vue, React, Bun, Cargo, Docker...</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Source Repositories */}
          {tab === 'sources' && (
            <div className="space-y-4">
              {/* Add Source */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-accent flex items-center gap-1.5">
                  <span>➕</span>
                  <span>添加自定义开源仓库监控</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="工具名称 (例如 MyAgent)"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-accent focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="GitHub Repo 或 本地路径"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => void handleAddSource()}
                    className="rounded-lg bg-accent px-4 py-1 text-xs font-medium text-white hover:bg-accent-hover transition shadow"
                  >
                    添加监控源
                  </button>
                </div>
              </div>

              {/* Sources List */}
              <div className="space-y-2">
                {syncStatus.sources?.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-white/10 transition"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">{s.name}</div>
                      <div className="text-[11px] text-muted truncate max-w-xs sm:max-w-md">{s.url}</div>
                    </div>
                    <button
                      onClick={() => void handleDeleteSource(s.id)}
                      className="rounded-lg px-2.5 py-1 text-[11px] text-red-400 hover:bg-red-500/20 transition"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Command Miner */}
          {tab === 'miner' && (
            <div className="space-y-4">
              <div className="text-xs text-muted">
                💡 粘贴包含斜杠命令的 TypeScript、Python 源码或 Markdown 帮助文档，系统将**自动提取命令并调用引擎完成地道标准化汉化**入库！
              </div>
              <textarea
                rows={6}
                placeholder="在此粘贴源码（例如 program.command('/plan').description('switch to Plan mode') 或 /clear - reset context）..."
                value={minerText}
                onChange={(e) => setMinerText(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white placeholder-white/30 focus:border-accent focus:outline-none font-mono"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => void handleMine()}
                  disabled={mining}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition shadow disabled:opacity-50"
                >
                  <span className={mining ? 'animate-spin' : ''}>🔍</span>
                  <span>{mining ? '智能解析萃取中...' : '开始萃取并汉化收录'}</span>
                </button>
              </div>

              {minedResults.length > 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 space-y-1.5">
                  <div className="text-xs font-bold text-emerald-400">
                    🎉 本次成功收录 {minedResults.length} 条全新命令：
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                    {minedResults.map((r, i) => (
                      <div key={i} className="text-muted font-mono">
                        {r.zh}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Learned Entries */}
          {tab === 'learned' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="搜索自动发现或学习的命令..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-accent focus:outline-none"
              />
              {filteredLearned.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted">暂无符合条件的自动发现词条</div>
              ) : (
                <div className="space-y-2">
                  {filteredLearned.map((e) => (
                    <div
                      key={e.original}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2.5 hover:border-white/10 transition"
                    >
                      <div className="space-y-0.5 truncate max-w-xs sm:max-w-md">
                        <div className="text-xs font-medium text-white truncate">{e.original}</div>
                        <div className="text-[11px] text-accent truncate">{e.translated}</div>
                      </div>
                      <button
                        onClick={() => void handleDeleteLearned(e.original)}
                        className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
