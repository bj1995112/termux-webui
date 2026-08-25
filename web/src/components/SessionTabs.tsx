import { useDeck } from '../store';

const ICONS: Record<string, string> = {
  shell: '🐚',
  claude: '✳',
  opencode: '◈',
  codex: '⌘',
  openclaw: '爪',
  hermes: '☿',
};

export default function SessionTabs() {
  const sessions = useDeck((s) => s.sessions);
  const activeId = useDeck((s) => s.activeId);
  const setActive = useDeck((s) => s.setActive);
  const killSession = useDeck((s) => s.killSession);

  return (
    <div className="flex gap-1 overflow-x-auto border-t border-border bg-panel px-1.5 py-1.5 [scrollbar-width:none]">
      {sessions.map((s, i) => (
        <button
          key={s.id}
          onClick={() => setActive(s.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            void killSession(s.id);
          }}
          className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
            s.id === activeId ? 'border-accent bg-accent/15 text-text' : 'border-border bg-panel2 text-muted'
          }`}
        >
          <span>{ICONS[s.kind] ?? '·'}</span>
          <span className="max-w-[72px] truncate">{s.kind === 'shell' ? `终端 ${i + 1}` : s.kind}</span>
        </button>
      ))}
      {sessions.length === 0 && <span className="px-2 py-1.5 text-xs text-muted">暂无会话,点右上角 ⊕ 新建</span>}
    </div>
  );
}
