import React, { useEffect, useState, useMemo } from 'react';
import { useDeck } from '../store.js';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface LearnedEntry {
  original: string;
  translated: string;
  category?: string;
  hitCount: number;
  createdAt: number;
  lastUsedAt: number;
  source?: string;
}

export const DictionaryManagerDialog: React.FC<Props> = ({ open, onClose }) => {
  const [entries, setEntries] = useState<LearnedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [editItem, setEditItem] = useState<{ original: string; translated: string } | null>(null);
  const [newOrig, setNewOrig] = useState('');
  const [newTrans, setNewTrans] = useState('');
  const showToast = useDeck((s) => s.showToast);

  const fetchDictionary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dictionary', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('twui.token') || ''}`,
        },
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.entries)) {
        setEntries(data.entries);
      }
    } catch {
      showToast('获取词库数据失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchDictionary();
    }
  }, [open]);

  const filteredEntries = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase().trim();
    return entries.filter(
      (e) => e.original.toLowerCase().includes(q) || e.translated.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const handleSaveEntry = async (original: string, translated: string) => {
    if (!original.trim() || !translated.trim()) {
      showToast('原文与译文均不能为空', 'error');
      return;
    }
    try {
      const res = await fetch('/api/dictionary/entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('twui.token') || ''}`,
        },
        body: JSON.stringify({ original: original.trim(), translated: translated.trim() }),
      });
      if (res.ok) {
        showToast('词条已保存并同步', 'success');
        setEditItem(null);
        setNewOrig('');
        setNewTrans('');
        void fetchDictionary();
      }
    } catch {
      showToast('保存失败', 'error');
    }
  };

  const handleDeleteEntry = async (original: string) => {
    try {
      const res = await fetch('/api/dictionary/entry', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('twui.token') || ''}`,
        },
        body: JSON.stringify({ original }),
      });
      if (res.ok) {
        showToast('词条已删除', 'info');
        setEntries((prev) => prev.filter((e) => e.original !== original));
      }
    } catch {
      showToast('删除失败', 'error');
    }
  };

  const handleExport = () => {
    window.open('/api/dictionary/export', '_blank');
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const list = JSON.parse(text);
      if (!Array.isArray(list)) throw new Error('无效的 JSON 词库文件');

      const res = await fetch('/api/dictionary/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('twui.token') || ''}`,
        },
        body: JSON.stringify({ entries: list }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`成功导入 ${data.importedCount} 条词条`, 'success');
        void fetchDictionary();
      }
    } catch (e) {
      showToast('导入失败：请检查文件格式', 'error');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in">
      <div className="flex h-[88vh] w-full max-w-2xl flex-col rounded-3xl border border-border/80 bg-panel/95 p-5 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <div>
              <h2 className="text-base font-bold text-text">编程词典与自学习记忆库</h2>
              <p className="text-[11px] text-muted">0ms 离线高精度翻译 · 自动捕获新词 · 永久持久化</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted hover:bg-panel2 hover:text-text active:scale-95 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2.5 py-3">
          <div className="rounded-2xl border border-accent/20 bg-accent/10 p-2.5 text-center">
            <span className="text-[11px] text-accent font-medium">内置标准词库</span>
            <p className="text-base font-bold text-accent">2,580+ 词条</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-center">
            <span className="text-[11px] text-emerald-400 font-medium">已自动学习</span>
            <p className="text-base font-bold text-emerald-400">{entries.length} 词条</p>
          </div>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-2.5 text-center">
            <span className="text-[11px] text-sky-400 font-medium">本地离线响应</span>
            <p className="text-base font-bold text-sky-400">0 ms 瞬发</p>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-2 pb-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="搜索原文或中文译文..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel2 px-3 py-1.5 text-xs text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-text"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 rounded-xl border border-border bg-panel2 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-text active:scale-95 transition-all"
            title="导出词库 JSON 文件"
          >
            <span>📥</span>
            <span>导出</span>
          </button>
          <label className="flex cursor-pointer items-center gap-1 rounded-xl border border-border bg-panel2 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-text active:scale-95 transition-all">
            <span>📤</span>
            <span>导入</span>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>

        {/* Add Entry Quick Box */}
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-2.5">
          <input
            type="text"
            placeholder="新增英文短语 (如 /help, Build failed)"
            value={newOrig}
            onChange={(e) => setNewOrig(e.target.value)}
            className="flex-1 rounded-lg border border-border/80 bg-panel px-2.5 py-1 text-xs text-text placeholder:text-muted focus:outline-none"
          />
          <input
            type="text"
            placeholder="对应中文释义"
            value={newTrans}
            onChange={(e) => setNewTrans(e.target.value)}
            className="flex-1 rounded-lg border border-border/80 bg-panel px-2.5 py-1 text-xs text-text placeholder:text-muted focus:outline-none"
          />
          <button
            onClick={() => handleSaveEntry(newOrig, newTrans)}
            className="rounded-lg bg-accent px-3 py-1 text-xs font-bold text-white shadow active:bg-accent-hover"
          >
            ➕ 添加
          </button>
        </div>

        {/* List of Entries */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted">正在加载词库...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              {query ? '没有找到匹配的词条' : '暂无自学习词条，终端运行中将自动为您捕获积累！'}
            </div>
          ) : (
            filteredEntries.map((item) => {
              const isEditing = editItem?.original === item.original;
              return (
                <div
                  key={item.original}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-panel2/70 p-2.5 text-xs transition-all hover:border-accent/30"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-text truncate">{item.original}</span>
                      <span className="rounded bg-panel px-1.5 py-0.5 text-[9px] text-muted">
                        命中 {item.hitCount} 次
                      </span>
                    </div>
                    {isEditing ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editItem.translated}
                          onChange={(e) => setEditItem({ ...editItem, translated: e.target.value })}
                          className="flex-1 rounded border border-accent bg-panel px-2 py-0.5 text-xs text-text focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveEntry(item.original, editItem.translated)}
                          className="rounded bg-accent px-2 py-0.5 text-[11px] font-bold text-white"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditItem(null)}
                          className="rounded bg-panel px-2 py-0.5 text-[11px] text-muted"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <p className="mt-0.5 text-accent font-medium truncate">{item.translated}</p>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setEditItem({ original: item.original, translated: item.translated })}
                        className="rounded p-1 text-muted hover:text-accent active:scale-95"
                        title="编辑纠偏"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(item.original)}
                        className="rounded p-1 text-muted hover:text-red-400 active:scale-95"
                        title="删除词条"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted">
          <span>💡 提示：在终端中使用的未知英文，系统翻译后将自动永久收录到此</span>
          <button
            onClick={onClose}
            className="rounded-xl bg-panel2 px-4 py-1.5 text-xs font-semibold text-text hover:bg-border/60"
          >
            完成关闭
          </button>
        </div>
      </div>
    </div>
  );
};
