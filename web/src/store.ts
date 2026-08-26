import { create } from 'zustand';
import type { CliInfo, SessionInfo, AgentConversation, CliId } from '@termux-webui/shared';

interface DeckState {
  clis: CliInfo[];
  sessions: SessionInfo[];
  conversations: AgentConversation[];
  activeId: string | null;
  keyboardVisible: boolean;
  suppressKeyboard: boolean;
  followOutput: boolean;
  loadClis: () => Promise<void>;
  loadSessions: () => Promise<void>;
  loadHistory: () => Promise<void>;
  createSession: (
    kind: SessionInfo['kind'],
    cwd?: string,
    args?: string[],
    env?: Record<string, string>,
  ) => Promise<SessionInfo>;
  resumeConversation: (conv: AgentConversation) => Promise<SessionInfo>;
  deleteHistory: (cli: CliId, id: string) => Promise<void>;
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

const strPref = (key: string, fallback: string | null): string | null => {
  const saved = localStorage.getItem(key);
  return saved === null ? fallback : saved;
};

export const useDeck = create<DeckState>((set, get) => ({
  clis: [],
  sessions: [],
  conversations: [],
  activeId: strPref('twui.activeId', null),
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
    const currentActive = get().activeId || localStorage.getItem('twui.activeId');
    const matched = sessions.find((s) => s.id === currentActive);
    const resolvedActive = matched ? matched.id : (sessions.at(-1)?.id ?? null);
    
    if (resolvedActive) {
      localStorage.setItem('twui.activeId', resolvedActive);
    } else {
      localStorage.removeItem('twui.activeId');
    }

    set({
      sessions,
      activeId: resolvedActive,
    });
  },

  loadHistory: async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        set({ conversations: await res.json() });
      }
    } catch {
      /* ignore */
    }
  },

  createSession: async (kind, cwd, args, env) => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, cwd, args, env }),
    });
    if (!res.ok) throw new Error('create failed');
    const info: SessionInfo = await res.json();
    localStorage.setItem('twui.activeId', info.id);
    set((s) => ({ sessions: [...s.sessions, info], activeId: info.id }));
    return info;
  },

  resumeConversation: async (conv) => {
    const res = await fetch('/api/sessions/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cli: conv.cli, id: conv.id, cwd: conv.cwd }),
    });
    if (!res.ok) throw new Error('resume failed');
    const info: SessionInfo = await res.json();
    localStorage.setItem('twui.activeId', info.id);
    set((s) => ({ sessions: [...s.sessions, info], activeId: info.id }));
    return info;
  },

  deleteHistory: async (cli, id) => {
    await fetch(`/api/history/${cli}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    set((s) => ({
      conversations: s.conversations.filter((c) => !(c.cli === cli && c.id === id)),
    }));
  },

  killSession: async (id) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    get().removeLocal(id);
  },

  setActive: (id) => {
    if (id) {
      localStorage.setItem('twui.activeId', id);
    } else {
      localStorage.removeItem('twui.activeId');
    }
    set({ activeId: id });
  },

  removeLocal: (id) => {
    setTimeout(() => {
      void get().loadHistory();
    }, 400);
    set((s) => {
      const sessions = s.sessions.filter((x) => x.id !== id);
      const nextActive = s.activeId === id ? (sessions.at(-1)?.id ?? null) : s.activeId;
      if (nextActive) {
        localStorage.setItem('twui.activeId', nextActive);
      } else {
        localStorage.removeItem('twui.activeId');
      }
      return {
        sessions,
        activeId: nextActive,
      };
    });
  },

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
