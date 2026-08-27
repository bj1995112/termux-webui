import { useState } from 'react';
import type { DETAILED_COMMAND_HELP_MAP } from '@termux-webui/shared';

type CommandHelp = (typeof DETAILED_COMMAND_HELP_MAP)[string];

interface Props {
  activeHelp: CommandHelp | null;
  onExecute?: (enCmd: string) => void;
}

export function ActiveCommandPreview({ activeHelp, onExecute }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (!activeHelp) return null;

  return (
    <div className="pointer-events-auto absolute bottom-14 left-3 right-3 sm:left-6 sm:right-6 z-30 animate-slide-up">
      <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-panel/95 backdrop-blur-xl p-3.5 shadow-2xl transition-all">
        {/* Glowing Ambient Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-accent to-pink-500 opacity-80" />

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 items-center rounded-lg bg-accent/20 px-2 font-mono text-xs font-bold text-accent border border-accent/30">
              {activeHelp.enCmd}
            </span>
            <span className="text-xs font-bold text-white tracking-wide">
              {activeHelp.title}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onExecute && (
              <button
                onClick={() => onExecute(activeHelp.enCmd)}
                className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent-hover transition shadow"
              >
                执行此命令 ↵
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
          <div className="mt-2.5 space-y-1.5 text-xs text-white/80 border-t border-white/5 pt-2">
            <p className="leading-relaxed">{activeHelp.desc}</p>
            {activeHelp.usage && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-300/90">
                <span className="text-muted">用法:</span>
                <code>{activeHelp.usage}</code>
              </div>
            )}
            {activeHelp.tip && (
              <div className="flex items-start gap-1.5 text-[11px] text-amber-300/90">
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
