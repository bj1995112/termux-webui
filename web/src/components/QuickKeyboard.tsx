import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { deckSocket } from "../lib/ws.js";
import { useDeck } from "../store.js";

interface KeyDef {
  label: string;
  seq: string | null; // null -> modifier toggle
  sub?: string;
}

const key = (label: string, seq: string | null, sub?: string): KeyDef => ({ label, seq, sub });

// ============================================================================
// 1. 2行黄金模式 (4 大分页，高度 ~92px，专为手机大拇指与 AI 编程设计)
// ============================================================================
const TWO_ROW_PAGES = [
  { id: "core", label: "核心" },
  { id: "agent", label: "AI指挥" },
  { id: "symbols", label: "符号" },
  { id: "fn", label: "功能" },
] as const;

// 2-Row Page 1: 核心与审批
const TWO_ROW_CORE_R1 = [
  key("Esc", "\x1b"),
  key("Tab", "\t"),
  key("Ctrl", null),
  key("Alt", null),
  key("Ctrl+C", "\x03"),
  key("Ctrl+D", "\x04"),
  key("Enter", "\r"),
  key("⌫", "\x7f"),
];
const TWO_ROW_CORE_R2 = [
  key("←", "\x1b[D"),
  key("↑", "\x1b[A"),
  key("↓", "\x1b[B"),
  key("→", "\x1b[C"),
  key("y 确认", "y\r"),
  key("n 拒绝", "n\r"),
  key("@ 引用", "@"),
  key("📋 粘贴", "__PASTE__"),
];

// 2-Row Page 2: AI 编程与代码检查
const TWO_ROW_AGENT_R1 = [
  key("🎯 /goal", "/goal "),
  key("📋 /plan", "/plan "),
  key("🔍 /diff", "/diff "),
  key("↩️ /undo", "/undo "),
  key("🔍 /review", "/review "),
];
const TWO_ROW_AGENT_R2 = [
  key("🗜️ /compact", "/compact "),
  key("💰 /cost", "/cost "),
  key("🧪 跑测试", "pnpm test\r"),
  key("📋 查状态", "git status\r"),
  key("⚡ /", "/"),
  key("🧹 清屏", "\x0c"),
];

// 2-Row Page 3: 高频代码符号与跳转
const TWO_ROW_SYM_R1 = [
  key("| 管道", " | "),
  key("&& 串联", " && "),
  key("~ 根目录", "~/"),
  key("/", "/"),
  key("-", "-"),
  key("_", "_"),
  key("$ 变量", "$"),
  key(";", ";"),
];
const TWO_ROW_SYM_R2 = [
  key("\"", "\""),
  key("'", "'"),
  key("\`", "\`"),
  key("()", "()"),
  key("{}", "{}"),
  key("Home", "\x1b[H"),
  key("End", "\x1b[F"),
  key("PgUp", "\x1b[5~"),
];

// 2-Row Page 4: F1 ~ F12 功能键
const TWO_ROW_FN_R1 = [
  key("F1", "\x1bOP"), key("F2", "\x1bOQ"), key("F3", "\x1bOR"),
  key("F4", "\x1bOS"), key("F5", "\x1b[15~"), key("F6", "\x1b[17~"),
];
const TWO_ROW_FN_R2 = [
  key("F7", "\x1b[18~"), key("F8", "\x1b[19~"), key("F9", "\x1b[20~"),
  key("F10", "\x1b[21~"), key("F11", "\x1b[23~"), key("F12", "\x1b[24~"),
];

// ============================================================================
// 2. 3行经典大键盘 (5 大分页，Termux 原汁原味全套按键，高度 156px)
// ============================================================================
const THREE_ROW_PAGES = [
  { id: "core", label: "核心" },
  { id: "agent", label: "指令" },
  { id: "edit", label: "编辑" },
  { id: "symbols", label: "符号" },
  { id: "fn", label: "功能" },
] as const;

const NAV_KEYS = [
  key("Home", "\x1b[H"), key("↑", "\x1b[A"), key("End", "\x1b[F"),
  key("←", "\x1b[D"), key("↓", "\x1b[B"), key("→", "\x1b[C"),
];
const TOP_KEYS = [
  key("Ctrl+C", "\x03"), key("Ctrl+D", "\x04"), key("Ctrl+J", "\x0a"),
  key("Shift", null), key("Enter", "\r"), key("⌫", "\x7f"),
];
const TERMUX_ROW1 = [
  key("Esc", "\x1b"), key("/", "/"), key("-", "-"), ...NAV_KEYS.slice(0, 3),
  key("PgUp", "\x1b[5~"),
];
const TERMUX_ROW2 = [
  key("Tab", "\t"), key("Ctrl", null), key("Alt", null),
  NAV_KEYS[3], NAV_KEYS[4], NAV_KEYS[5],
  key("PgDn", "\x1b[6~"),
];

const AGENT_ROW1 = [
  key("y 确认", "y\r"), key("n 拒绝", "n\r"), key("中断", "\x03"),
  key("挂起", "\x1a"), key("清屏", "\x0c"), key("退出", "exit\r"),
];
const AGENT_ROW2 = [
  key("/help", "/help\r"), key("/resume", "/resume\r"), key("/compact", "/compact\r"),
  key("/cost", "/cost\r"), key("/review", "/review\r"), key("/plan", "/plan\r"),
];
const AGENT_ROW3 = [
  key("status", "git status\r"), key("diff", "git diff\r"), key("log", "git log -n 5\r"),
  key("test", "pnpm test\r"), key("ls", "ls -la\r"), key("cd ..", "cd ..\r"),
];

const EDIT_KEYS_ROW1 = [
  key("跳行首", "\x01", "Ctrl+A"), key("跳行尾", "\x05", "Ctrl+E"),
  key("删前词", "\x17", "Ctrl+W"), key("清整行", "\x15", "Ctrl+U"),
];
const EDIT_KEYS_ROW2 = [
  key("删后文", "\x0b", "Ctrl+K"), key("搜历史", "\x12", "Ctrl+R"),
  key("反向制表", "\x1b[Z", "⇧Tab"), key("后删除", "\x1b[3~", "Del"),
];

const SYMBOL_KEYS = "()[]{}<>'\"`=+*-/~!&|_\\$.:;,%^?#@".split("").map((c) => key(c, c));

const FN_ROW1 = [
  key("F1", "\x1bOP"), key("F2", "\x1bOQ"), key("F3", "\x1bOR"), key("F4", "\x1bOS"),
];
const FN_ROW2 = [
  key("F5", "\x1b[15~"), key("F6", "\x1b[17~"), key("F7", "\x1b[18~"), key("F8", "\x1b[19~"),
];
const FN_ROW3 = [
  key("F9", "\x1b[20~"), key("F10", "\x1b[21~"), key("F11", "\x1b[23~"), key("F12", "\x1b[24~"),
];

export default function QuickKeyboard({
  sessionId,
  onHide,
}: {
  sessionId: string;
  onHide: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ id: number; x: number; y: number; item: KeyDef; swiped: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [mods, setMods] = useState({ ctrl: false, alt: false, shift: false });
  
  // Layout mode: 2row vs 3row (defaults to 2row)
  const [layoutMode, setLayoutMode] = useState<"2row" | "3row">(() => {
    return (localStorage.getItem("twui.keyboardLayout") as "2row" | "3row") || "2row";
  });

  const suppressKeyboard = useDeck((s) => s.suppressKeyboard);
  const toggleSuppressKeyboard = useDeck((s) => s.toggleSuppressKeyboard);
  const followOutput = useDeck((s) => s.followOutput);
  const toggleFollowOutput = useDeck((s) => s.toggleFollowOutput);

  const activePages = layoutMode === "2row" ? TWO_ROW_PAGES : THREE_ROW_PAGES;
  const displayPages = useMemo(() => {
    return [activePages[activePages.length - 1], ...activePages, activePages[0]];
  }, [activePages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.clientWidth;
    setPage(0);
  }, [layoutMode]);

  // Keep only the keyboard dock aware of the browser visual viewport.
  // This never resizes xterm or changes its input focus.
  useEffect(() => {
    const el = keyboardRef.current;
    const vv = window.visualViewport;
    if (!el || !vv) return;

    const updateDock = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.bottom = `${overlap}px`;
    };

    updateDock();
    vv.addEventListener("resize", updateDock);
    vv.addEventListener("scroll", updateDock);
    window.addEventListener("orientationchange", updateDock);
    return () => {
      vv.removeEventListener("resize", updateDock);
      vv.removeEventListener("scroll", updateDock);
      window.removeEventListener("orientationchange", updateDock);
    };
  }, []);

  const toggleLayoutMode = useCallback(() => {
    const next = layoutMode === "2row" ? "3row" : "2row";
    localStorage.setItem("twui.keyboardLayout", next);
    setLayoutMode(next);
  }, [layoutMode]);

  const send = useCallback(
    (seq: string) => {
      deckSocket.send({ type: "input", sessionId, data: seq });
      navigator.vibrate?.(10);
    },
    [sessionId],
  );

  const pasteClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard?.readText();
      if (text) send(text);
    } catch {
      /* clipboard permission optional on plain HTTP */
    }
  }, [send]);

  const sendKey = useCallback(
    (item: KeyDef) => {
      if (item.seq === "__PASTE__") {
        void pasteClipboard();
        return;
      }
      let seq = item.seq ?? "";
      if (mods.ctrl && item.label.length === 1) {
        const code = item.label.toUpperCase().charCodeAt(0);
        if (code >= 64 && code <= 95) seq = String.fromCharCode(code - 64);
      } else if (mods.alt && item.seq) {
        seq = `\x1b${item.seq}`;
      } else if (mods.shift && item.label.length === 1) {
        seq = item.label.toUpperCase();
      }
      send(seq);
      setMods({ ctrl: false, alt: false, shift: false });
    },
    [mods, send, pasteClipboard],
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !el.clientWidth) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx === 0) {
      el.scrollTo({ left: activePages.length * el.clientWidth });
      setPage(activePages.length - 1);
    } else if (idx === displayPages.length - 1) {
      el.scrollTo({ left: el.clientWidth });
      setPage(0);
    } else {
      setPage(idx - 1);
    }
  }, [activePages.length, displayPages.length]);

  const gotoPage = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: (idx + 1) * el.clientWidth, behavior: "smooth" });
  }, []);

  const copySelection = useCallback(() => {
    window.dispatchEvent(new CustomEvent("termux-webui-copy-selection"));
  }, []);

  const selectAll = useCallback(() => {
    window.dispatchEvent(new CustomEvent("termux-webui-select-all"));
  }, []);

  const focusHelperTextarea = useCallback(() => {
    document.querySelector<HTMLTextAreaElement>(".xterm-helper-textarea")?.focus();
  }, []);

  const renderKey = useCallback(
    (k: KeyDef) => (
      <button
        key={k.label + (k.seq ?? "")}
        className={`flex h-full min-h-0 flex-col items-center justify-center rounded-md border border-border bg-panel2 px-1 text-[12px] leading-tight active:bg-accent/30 ${
          k.seq === null ? "text-muted" : "text-text"
        }`}
        onPointerDown={(e) => {
          e.preventDefault();
          pointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, item: k, swiped: false };
        }}
        onPointerMove={(e) => {
          const p = pointerRef.current;
          if (p && p.id === e.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) p.swiped = true;
        }}
        onPointerUp={() => {
          const p = pointerRef.current;
          pointerRef.current = null;
          if (!p || p.swiped) return;
          if (p.item.seq === null) {
            const name = p.item.label.toLowerCase() as "ctrl" | "alt" | "shift";
            setMods((m) => ({ ...m, [name]: !m[name] }));
          } else {
            sendKey(p.item);
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className={mods[k.label.toLowerCase() as "ctrl" | "alt" | "shift"] ? "font-bold text-accent" : ""}>
          {k.label}
        </span>
        {k.sub && <span className="text-[9px] text-muted truncate max-w-full">{k.sub}</span>}
      </button>
    ),
    [mods, sendKey],
  );

  const ActionButton = useCallback(
    ({ label, onClick }: { label: string; onClick: () => void }) => (
      <button
        onClick={onClick}
        className="flex h-full min-h-0 items-center justify-center rounded-md border border-border bg-panel2 text-[12px] active:bg-accent/30"
      >
        {label}
      </button>
    ),
    [],
  );

  return (
    <div
      ref={keyboardRef}
      className="fixed left-0 right-0 z-50 select-none border-t border-border bg-panel"
      style={{ bottom: "0px", paddingBottom: "0px" }}
    >
      <div className="flex h-[72px] w-full flex-col gap-1 p-1">
        <div className="grid min-h-0 flex-1 grid-cols-7 gap-1">
          {TERMUX_ROW1.map(renderKey)}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7 gap-1">
          {TERMUX_ROW2.map(renderKey)}
        </div>
      </div>
    </div>
  );
}
