import { create } from 'zustand';
import type { CliInfo, SessionInfo } from '@termux-webui/shared';

interface DeckState {
  clis: CliInfo[];
  sessions: SessionInfo[];
  activeId: string | null;
  keyboardVisible: boolean;
  suppressKeyboard: boolean;
  followOutput: boolean;
  loadClis: () => Promise<void>;
  loadSessions: () => Promise<void>;
  createSession: (kind: SessionInfo['kind'], cwd?: string) => Promise<SessionInfo>;
  killSession: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  removeLocal: (id: string) => void;
  toggleKeyboard: (visible?: boolean) => void;
  toggleSuppressKeyboard: (value?: boolean) => void;
  toggleFollowOutput: (value?: boolean) => void;
}

const boolPref = (key: string, fallback: boolean): boolean => {
  const saved = localStorage.getItem(key);
  return saved === null ? fallback : saved === '1';
};

export const useDeck = create<DeckState>((set, get) => ({
  clis: [],
  sessions: [],
  activeId: null,
  keyboardVisible: true,
  suppressKeyboard: boolPref('twui.suppressKeyboard', false),
  followOutput: boolPref('twui.followOutput', true),

  loadClis: async () => {
    const res = await fetch('/api/clis');
    set({ clis: await res.json() });
  },

  loadSessions: async () => {
    const res = await fetch('/api/sessions');
    const sessions: SessionInfo[] = await res.json();
    const active = get().activeId;
    set({
      sessions,
      activeId: active && sessions.some((s) => s.id === active) ? active : (sessions.at(-1)?.id ?? null),
    });
  },

  createSession: async (kind, cwd) => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, cwd }),
    });
    if (!res.ok) throw new Error('create failed');
    const info: SessionInfo = await res.json();
    set((s) => ({ sessions: [...s.sessions, info], activeId: info.id }));
    // attach happens in TermView once its message handler is registered.
    return info;
  },

  killSession: async (id) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    get().removeLocal(id);
  },

  setActive: (id) => {
    // No attach here — TermView attaches itself after registering its
    // message handler, so the prompt can never arrive un-received.
    set({ activeId: id });
  },

  removeLocal: (id) =>
    set((s) => {
      const sessions = s.sessions.filter((x) => x.id !== id);
      return {
        sessions,
        activeId: s.activeId === id ? (sessions.at(-1)?.id ?? null) : s.activeId,
      };
    }),

  toggleKeyboard: (visible) =>
    set((s) => ({ keyboardVisible: visible ?? !s.keyboardVisible })),

  toggleSuppressKeyboard: (value) => {
    const next = value ?? !get().suppressKeyboard;
    localStorage.setItem('twui.suppressKeyboard', next ? '1' : '0');
    set({ suppressKeyboard: next });
  },

  toggleFollowOutput: (value) => {
    const next = value ?? !get().followOutput;
    localStorage.setItem('twui.followOutput', next ? '1' : '0');
    set({ followOutput: next });
  },
}));
