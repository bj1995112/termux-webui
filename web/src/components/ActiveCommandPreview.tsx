import { useState, useEffect } from 'react';
import type { DETAILED_COMMAND_HELP_MAP } from '@termux-webui/shared';

type CommandHelp = (typeof DETAILED_COMMAND_HELP_MAP)[string];

interface Props {
  activeHelp: CommandHelp | null;
  onExecute?: (enCmd: string) => void;
}

/**
 * Keyboard-Safe Active Command Preview Capsule
 * Floats near the top of the terminal viewport (under the top bar) to guarantee
 * 100% visibility even when the mobile virtual keyboard is fully expanded!
 */
export function ActiveCommandPreview({ activeHelp, onExecute }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Reset collapsed state when active help changes
    if (activeHelp) {
      setCollapsed(false);
    }
  }, [activeHelp?.enCmd]);

  if (!activeHelp) return null;

  return (
    <div className="pointer-events-auto absolute top-14 left-3 right-3 sm:left-6 sm:right-6 z-40 animate-slide-down">
      <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-panel/95 backdrop-blur-2xl p-3 shadow-2xl transition-all">
        {/* Glowing Accent Ambient Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-accent to-pink-500 opacity-90" />

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="flex h-5 items-center rounded-md bg-accent/20 px-2 font-mono text-[11px] font-bold text-accent border border-accent/30 flex-shrink-0">
              {activeHelp.enCmd}
            </span>
            <span className="text-xs font-bold text-white tracking-wide truncate">
              {activeHelp.title}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onExecute && (
              <button
                onClick={() => onExecute(activeHelp.enCmd)}
                className="rounded-lg bg-accent px-2.5 py-0.5 text-[11px] font-medium text-white hover:bg-accent-hover transition shadow active:scale-95"
              >
                运行 ↵
              </button>
            )}
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-lg p-1 text-muted hover:bg-white/10 hover:text-white transition text-xs"
              title={collapsed ? '展开详解' : '收起'}
            >
              {collapsed ? '▼' : '▲'}
            </button>
          </div>
        </div>

        {/* Expanded Description */}
        {!collapsed && (
          <div className="mt-2 space-y-1 text-[11px] text-white/85 border-t border-white/5 pt-1.5 leading-relaxed">
            <p>{activeHelp.desc}</p>
            {activeHelp.usage && (
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-cyan-300">
                <span className="text-muted">格式:</span>
                <code>{activeHelp.usage}</code>
              </div>
            )}
            {activeHelp.tip && (
              <div className="flex items-start gap-1 text-[10px] text-amber-300">
                <span>💡</span>
                <span>{activeHelp.tip}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
