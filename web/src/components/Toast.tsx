import { useDeck } from '../store';

export default function Toast() {
  const toast = useDeck((s) => s.toast);
  if (!toast) return null;

  const bg =
    toast.type === 'error'
      ? 'bg-red-500/90 text-white border-red-400/40'
      : toast.type === 'success'
      ? 'bg-emerald-500/90 text-white border-emerald-400/40'
      : 'bg-panel/95 text-text border-border';

  return (
    <div className="pointer-events-none fixed top-14 left-1/2 z-[100] -translate-x-1/2 transition-all duration-300 animate-in fade-in slide-in-from-top-4">
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium shadow-2xl backdrop-blur-md ${bg}`}>
        <span>{toast.type === 'error' ? '❌' : toast.type === 'success' ? '✅' : 'ℹ️'}</span>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
