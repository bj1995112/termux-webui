import { create } from 'zustand';
import type { CliInfo, SessionInfo } from '@agentdeck/shared';
import { deckSocket } from './lib/ws.js';

interface DeckState {
  clis: CliInfo[];
  sessions: SessionInfo[];
  activeId: string | null;
  keyboardVisible: boolean;
  loadClis: () => Promise<void>;
  loadSessions: () => Promise<void>;
  createSession: (kind: SessionInfo['kind'], cwd?: string) => Promise<SessionInfo>;
  killSession: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  removeLocal: (id: string) => void;
  toggleKeyboard: (visible?: boolean) => void;
}

export const useDeck = create<DeckState>((set, get) => ({
  clis: [],
  sessions: [],
  activeId: null,
  keyboardVisible: true,

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
    deckSocket.attach(info.id);
    return info;
  },

  killSession: async (id) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    get().removeLocal(id);
  },

  setActive: (id) => {
    if (id) deckSocket.attach(id);
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
}));
