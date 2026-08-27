import { useState } from 'react';
import { useDeck } from '../store';

function formatExactDate(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function ConversationPreviewModal() {
  const previewDetail = useDeck((s) => s.previewDetail);
  const closePreview = useDeck((s) => s.closePreview);
  const resumeConversation = useDeck((s) => s.resumeConversation);
  const showToast = useDeck((s) => s.showToast);
  const translateText = useDeck((s) => s.translateText);

  const [translations, setTranslations] = useState<Record<number, string>>({});

  if (!previewDetail) return null;

  const { conversation: conv, messages } = previewDetail;

  const handleTranslateMessage = async (idx: number, text: string) => {
    if (translations[idx]) {
      // Toggle off
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
      return;
    }
    showToast('正在翻译消息...', 'info');
    try {
      const translated = await translateText(text);
      setTranslations((prev) => ({ ...prev, [idx]: translated }));
    } catch {
      showToast('翻译失败', 'error');
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制到剪贴板', 'success');
      navigator.vibrate?.(20);
    } catch {
      showToast('复制失败', 'error');
    }
  };

  const handleResume = async () => {
    try {
      await resumeConversation(conv);
      closePreview();
      showToast('已成功拉起会话', 'success');
    } catch (err) {
      showToast(`恢复失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3"
      onClick={closePreview}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-panel shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-panel2/60">
          <div className="overflow-hidden pr-2">
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                {conv.cliLabel}
              </span>
              <h3 className="truncate text-sm font-bold text-text">{conv.title}</h3>
            </div>
            <p className="truncate text-[10px] text-muted font-mono mt-0.5">📁 {conv.cwd}</p>
          </div>
          <button
            onClick={closePreview}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel hover:text-text active:text-accent"
          >
            ✕
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 select-text">
          {messages.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              <p>暂无完整对话消息记录</p>
            </div>
          ) : (
            messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-muted">
                    <span>{isUser ? '👤 用户' : '🤖 AI Agent'}</span>
                    {m.timestamp && <span>· {formatExactDate(m.timestamp)}</span>}
                  </div>
                  <div
                    className={`group relative max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed break-words shadow-sm border ${
                      isUser
                        ? 'bg-accent/15 border-accent/30 text-text rounded-tr-sm'
                        : 'bg-panel2 border-border text-text/90 rounded-tl-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                    {/* Translated Content Block */}
                    {translations[idx] && (
                      <div className="mt-2 pt-2 border-t border-border/40 text-text font-sans text-xs bg-accent/5 p-2 rounded-lg border border-accent/20">
                        <span className="font-bold text-accent text-[10px] block mb-1">🇨🇳 译文：</span>
                        <div className="whitespace-pre-wrap">{translations[idx]}</div>
                      </div>
                    )}

                    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleTranslateMessage(idx, m.content)}
                        className="rounded bg-panel/90 px-1.5 py-0.5 text-[10px] text-accent hover:bg-panel shadow-sm"
                        title="翻译本条内容"
                      >
                        🌐 译
                      </button>
                      <button
                        onClick={() => handleCopy(m.content)}
                        className="rounded bg-panel/90 px-1.5 py-0.5 text-[10px] text-muted hover:text-text shadow-sm"
                        title="复制本段"
                      >
                        📋 复制
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-panel2/60 text-xs">
          <span className="text-[11px] text-muted font-mono">共 {messages.length} 条记录</span>
          <div className="flex gap-2">
            <button
              onClick={closePreview}
              className="rounded-lg border border-border px-3 py-1.5 text-muted hover:text-text"
            >
              关闭
            </button>
            <button
              onClick={handleResume}
              className="flex items-center gap-1 rounded-lg bg-accent px-3.5 py-1.5 font-semibold text-white shadow active:bg-accent-hover"
            >
              <span>🚀</span>
              <span>拉起继续聊</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
