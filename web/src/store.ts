import { create } from 'zustand';
import type {
  CliInfo,
  SessionInfo,
  AgentConversation,
  CliId,
  ConversationDetail,
  TranslationConfig,
  TranslateResponse,
} from '@termux-webui/shared';
import { type ThemeId, applyTheme } from './theme';
import { deckSocket } from './lib/ws';
import { getCachedTranslation, setCachedTranslation } from './lib/translateCache';

interface DeckState {
  clis: CliInfo[];
  sessions: SessionInfo[];
  conversations: AgentConversation[];
  activeId: string | null;
  keyboardVisible: boolean;
  suppressKeyboard: boolean;
  followOutput: boolean;

  // Auth
  token: string | null;
  isAuthenticated: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;

  // Theme & Appearance
  currentTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  resetFontSize: () => void;

  // Translation System
  translationConfig: TranslationConfig;
  setTranslationConfig: (cfg: Partial<TranslationConfig>) => void;
  isTranslatingScreen: boolean;
  toggleScreenTranslation: (force?: boolean) => void;
  translateText: (text: string, toLang?: string) => Promise<string>;

  // Toast
  toast: { message: string; type: 'info' | 'success' | 'error' } | null;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;

  // Read-only history preview
  previewDetail: ConversationDetail | null;
  loadConversationDetail: (cli: CliId, id: string) => Promise<void>;
  closePreview: () => void;

  // Session actions
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
  restartSession: (id: string) => Promise<void>;
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

// Initial theme setup
const savedTheme = (strPref('twui.theme', 'tokyo-night') as ThemeId) || 'tokyo-night';
applyTheme(savedTheme);

let toastTimer: number | null = null;

export const useDeck = create<DeckState>((set, get) => {
  const initialToken = localStorage.getItem('twui.token');

  const authFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const token = get().token;
    const headers = new Headers(init?.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401) {
      // Prompt re-auth
      set({ isAuthenticated: false });
    }
    return res;
  };

  return {
    clis: [],
    sessions: [],
    conversations: [],
    activeId: strPref('twui.activeId', null),
    keyboardVisible: true,
    suppressKeyboard: boolPref('twui.suppressKeyboard', false),
    followOutput: boolPref('twui.followOutput', true),

    token: initialToken,
    isAuthenticated: Boolean(initialToken),
    currentTheme: savedTheme,
    fontSize: (() => {
      const saved = localStorage.getItem('twui.fontSize');
      const num = saved ? parseInt(saved, 10) : 13;
      return num >= 6 && num <= 36 ? num : 13;
    })(),
    translationConfig: (() => {
      try {
        const saved = localStorage.getItem('twui.transConfig');
        return saved ? JSON.parse(saved) : { provider: 'auto' };
      } catch {
        return { provider: 'auto' };
      }
    })(),
    isTranslatingScreen: false,
    toast: null,
    previewDetail: null,

    setTranslationConfig: (cfg: Partial<TranslationConfig>) => {
      const current = get().translationConfig;
      const updated = { ...current, ...cfg };
      localStorage.setItem('twui.transConfig', JSON.stringify(updated));
      set({ translationConfig: updated });
      get().showToast('翻译引擎配置已更新', 'success');
    },

    toggleScreenTranslation: (force?: boolean) => {
      const next = typeof force === 'boolean' ? force : !get().isTranslatingScreen;
      set({ isTranslatingScreen: next });
      get().showToast(next ? '🌐 全屏原位翻译已开启' : '🌐 已切回原生英文终端', 'info');
    },

    translateText: async (text: string, toLang = 'zh-CN') => {
      const clean = text.trim();
      if (!clean) return text;

      // 1. Zero-latency local cache lookup
      const cached = await getCachedTranslation(clean, toLang);
      if (cached) return cached;

      // 2. Fetch from backend proxy
      try {
        const res = await authFetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: clean,
            to: toLang,
            config: get().translationConfig,
          }),
        });
        const data = (await res.json()) as TranslateResponse;
        if (data.ok && data.translated) {
          void setCachedTranslation(clean, data.translated, toLang);
          return data.translated;
        }
        return clean;
      } catch (err) {
        console.warn('Translation request error:', err);
        return clean;
      }
    },

    setFontSize: (size: number) => {
      const clamped = Math.min(36, Math.max(6, Math.round(size)));
      localStorage.setItem('twui.fontSize', String(clamped));
      set({ fontSize: clamped });
    },

    resetFontSize: () => {
      localStorage.setItem('twui.fontSize', '13');
      set({ fontSize: 13 });
      get().showToast('终端字号已重置为 13px (Termux 默认)', 'info');
    },

    showToast: (message, type = 'info') => {
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: { message, type } });
      toastTimer = window.setTimeout(() => {
        set({ toast: null });
        toastTimer = null;
      }, 2500);
    },

    setTheme: (theme) => {
      localStorage.setItem('twui.theme', theme);
      applyTheme(theme);
      set({ currentTheme: theme });
      get().showToast(`已切换主题: ${theme}`, 'info');
    },

    login: async (password) => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (data.ok && data.token) {
          localStorage.setItem('twui.token', data.token);
          set({ token: data.token, isAuthenticated: true });
          deckSocket.setToken(data.token);
          deckSocket.connect();
          void get().loadClis();
          void get().loadSessions();
          void get().loadHistory();
          get().showToast('登录成功，欢迎使用 Termux WebUI', 'success');
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },

    logout: async () => {
      const token = get().token;
      if (token) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          /* ignore */
        }
      }
      localStorage.removeItem('twui.token');
      set({ token: null, isAuthenticated: false });
      deckSocket.setToken(null);
      deckSocket.close();
      get().showToast('已安全登出', 'info');
    },

    checkAuth: async () => {
      const token = get().token;
      if (!token) {
        set({ isAuthenticated: false });
        return;
      }
      try {
        const res = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          set({ isAuthenticated: true });
          deckSocket.setToken(token);
        } else {
          set({ isAuthenticated: false, token: null });
          localStorage.removeItem('twui.token');
        }
      } catch {
        // Offline or connection issue
      }
    },

    loadClis: async () => {
      try {
        const res = await authFetch('/api/clis');
        if (res.ok) set({ clis: await res.json() });
      } catch {
        /* ignore */
      }
    },

    loadSessions: async () => {
      try {
        const res = await authFetch('/api/sessions');
        if (!res.ok) return;
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
      } catch {
        /* ignore */
      }
    },

    loadHistory: async () => {
      try {
        const res = await authFetch('/api/history');
        if (res.ok) {
          set({ conversations: await res.json() });
        }
      } catch {
        /* ignore */
      }
    },

    loadConversationDetail: async (cli, id) => {
      try {
        const res = await authFetch(`/api/history/${cli}/${encodeURIComponent(id)}/detail`);
        if (res.ok) {
          const detail: ConversationDetail = await res.json();
          set({ previewDetail: detail });
        } else {
          get().showToast('加载对话详情失败', 'error');
        }
      } catch {
        get().showToast('网络错误，无法查看详情', 'error');
      }
    },

    closePreview: () => set({ previewDetail: null }),

    createSession: async (kind, cwd, args, env) => {
      const res = await authFetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, cwd, args, env }),
      });
      if (!res.ok) {
        get().showToast('创建会话失败', 'error');
        throw new Error('create failed');
      }
      const info: SessionInfo = await res.json();
      localStorage.setItem('twui.activeId', info.id);
      set((s) => ({ sessions: [...s.sessions, info], activeId: info.id }));
      get().showToast(`终端已就绪: ${kind}`, 'success');
      return info;
    },

    resumeConversation: async (conv) => {
      const res = await authFetch('/api/sessions/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cli: conv.cli, id: conv.id, cwd: conv.cwd }),
      });
      if (!res.ok) {
        get().showToast('恢复会话失败', 'error');
        throw new Error('resume failed');
      }
      const info: SessionInfo = await res.json();
      localStorage.setItem('twui.activeId', info.id);
      set((s) => ({ sessions: [...s.sessions, info], activeId: info.id }));
      get().showToast(`已恢复对话: ${conv.title}`, 'success');
      return info;
    },

    restartSession: async (id) => {
      const res = await authFetch(`/api/sessions/${id}/restart`, {
        method: 'POST',
      });
      if (res.ok) {
        const info: SessionInfo = await res.json();
        set((s) => ({
          sessions: s.sessions.map((x) => (x.id === id ? info : x)),
        }));
        get().showToast('会话已重新启动', 'success');
      } else {
        get().showToast('重启会话失败', 'error');
      }
    },

    deleteHistory: async (cli, id) => {
      const res = await authFetch(`/api/history/${cli}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        set((s) => ({
          conversations: s.conversations.filter((c) => !(c.cli === cli && c.id === id)),
        }));
        get().showToast('已删除该历史记录', 'info');
      } else {
        get().showToast('删除失败', 'error');
      }
    },

    killSession: async (id) => {
      await authFetch(`/api/sessions/${id}`, { method: 'DELETE' });
      get().removeLocal(id);
      get().showToast('会话已关闭', 'info');
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
  };
});
