import { useEffect, useState, useRef } from 'react';
import { useDeck } from '../store.js';
import { translateText, type TranslateConfig } from '../lib/translator.js';

export default function FocusBar({ sessionId }: { sessionId: string }) {
  const focusBarEnabled = useDeck((s) => s.focusBarEnabled);
  const activeFocus = useDeck((s) => s.activeFocus);
  const translateEngine = useDeck((s) => s.translateEngine);
  const aiApiUrl = useDeck((s) => s.aiApiUrl);
  const aiApiKey = useDeck((s) => s.aiApiKey);
  const aiModel = useDeck((s) => s.aiModel);
  const customApiUrl = useDeck((s) => s.customApiUrl);

  const [asyncTranslation, setAsyncTranslation] = useState<string>('');
  const prevTextRef = useRef<string>('');

  useEffect(() => {
    if (!activeFocus || !focusBarEnabled) return;

    if (activeFocus.instantTranslation) {
      setAsyncTranslation(activeFocus.instantTranslation);
      return;
    }

    if (activeFocus.text !== prevTextRef.current) {
      prevTextRef.current = activeFocus.text;
      const config: TranslateConfig = {
        engine: translateEngine,
        aiApiUrl,
        aiApiKey,
        aiModel,
        customApiUrl,
      };
      translateText(activeFocus.text, config)
        .then((res) => setAsyncTranslation(res.text))
        .catch(() => setAsyncTranslation(activeFocus.text));
    }
  }, [activeFocus, focusBarEnabled, translateEngine, aiApiUrl, aiApiKey, aiModel, customApiUrl]);

  if (!focusBarEnabled || !activeFocus) return null;

  const displayChinese = activeFocus.instantTranslation || asyncTranslation || activeFocus.text;

  return (
    <div
      translate="no"
      className="flex-shrink-0 flex flex-col justify-center px-3 py-2 bg-panel2 border-t border-border shadow-md text-xs select-none transition-all duration-150 min-h-[42px] max-h-[140px] overflow-y-auto z-30"
    >
      {/* 1. Header: Badge + Command + Status */}
      <div className="flex items-center justify-between gap-1.5 mb-1 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="font-bold text-accent">💡 选项释义</span>
          <span className="rounded bg-accent/15 px-1.5 py-0.5 font-semibold text-[11px] text-accent border border-accent/30">
            {activeFocus.badge}
          </span>
          {activeFocus.command && (
            <span className="rounded bg-panel px-1.5 py-0.5 font-mono text-[11px] text-muted border border-border">
              {activeFocus.command}
            </span>
          )}
        </div>

        <span className="flex-shrink-0 text-[10px] text-muted">
          {activeFocus.instantTranslation ? '⚡ 0ms秒出' : '✓ 已翻译'}
        </span>
      </div>

      {/* 2. Body: Full Chinese Text with Dynamic Auto Height */}
      <div className="text-[12.5px] leading-relaxed text-text/95 whitespace-normal break-words select-text">
        {displayChinese}
      </div>
    </div>
  );
}
