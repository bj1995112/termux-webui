import type { ITheme } from '@xterm/xterm';

export type TerminalThemeId =
  | 'termux-classic'
  | 'tokyo-night'
  | 'cyber-oled'
  | 'catppuccin'
  | 'dracula'
  | 'nord'
  | string;

export interface TerminalThemeConfig {
  id: TerminalThemeId;
  name: string;
  nameEn?: string;
  badge: string;
  description: string;
  builtIn?: boolean;
  terminal: ITheme;
}

export const BUILTIN_TERMINAL_THEMES: TerminalThemeConfig[] = [
  {
    id: 'termux-classic', name: 'Termux 经典', nameEn: 'Termux Classic', badge: '⌁',
    description: '接近 Termux 原生终端的简洁高对比风格', builtIn: true,
    terminal: {
      background: '#000000', foreground: '#ffffff', cursor: '#ffffff', cursorAccent: '#000000', selectionBackground: '#ffffff33',
      black: '#000000', red: '#ff5555', green: '#55ff55', yellow: '#ffff55', blue: '#5555ff', magenta: '#ff55ff', cyan: '#55ffff', white: '#ffffff',
      brightBlack: '#555555', brightRed: '#ff5555', brightGreen: '#55ff55', brightYellow: '#ffff55', brightBlue: '#5555ff', brightMagenta: '#ff55ff', brightCyan: '#55ffff', brightWhite: '#ffffff',
    },
  },
  {
    id: 'tokyo-night', name: 'Tokyo Night', nameEn: 'Tokyo Night', badge: '🌌',
    description: '深邃蓝紫，现代开发风格', builtIn: true,
    terminal: { background:'#1a1b26', foreground:'#c0caf5', cursor:'#7aa2f7', cursorAccent:'#1a1b26', selectionBackground:'#33467c88', black:'#15161e', red:'#f7768e', green:'#9ece6a', yellow:'#e0af68', blue:'#7aa2f7', magenta:'#bb9af7', cyan:'#7dcfff', white:'#a9b1d6', brightBlack:'#414868', brightRed:'#f7768e', brightGreen:'#9ece6a', brightYellow:'#e0af68', brightBlue:'#7aa2f7', brightMagenta:'#bb9af7', brightCyan:'#7dcfff', brightWhite:'#c0caf5' },
  },
  {
    id: 'cyber-oled', name: 'Cyber OLED', nameEn: 'Cyber OLED', badge: '◉',
    description: 'AMOLED 纯黑，高亮度赛博配色', builtIn: true,
    terminal: { background:'#000000', foreground:'#f0f6fc', cursor:'#00f0ff', cursorAccent:'#000000', selectionBackground:'#00f0ff33', black:'#0a0a0c', red:'#ff3366', green:'#00ff9f', yellow:'#ffe600', blue:'#00f0ff', magenta:'#bd00ff', cyan:'#00f0ff', white:'#ffffff', brightBlack:'#333333', brightRed:'#ff5588', brightGreen:'#33ffb5', brightYellow:'#fff044', brightBlue:'#44f4ff', brightMagenta:'#d144ff', brightCyan:'#44f4ff', brightWhite:'#ffffff' },
  },
  {
    id: 'catppuccin', name: 'Catppuccin Mocha', nameEn: 'Catppuccin Mocha', badge: '☕',
    description: '柔和粉彩，低刺激深色风格', builtIn: true,
    terminal: { background:'#1e1e2e', foreground:'#cdd6f4', cursor:'#f5e0dc', cursorAccent:'#1e1e2e', selectionBackground:'#585b7066', black:'#45475a', red:'#f38ba8', green:'#a6e3a1', yellow:'#f9e2af', blue:'#89b4fa', magenta:'#f5c2e7', cyan:'#94e2d5', white:'#bac2de', brightBlack:'#585b70', brightRed:'#f38ba8', brightGreen:'#a6e3a1', brightYellow:'#f9e2af', brightBlue:'#89b4fa', brightMagenta:'#f5c2e7', brightCyan:'#94e2d5', brightWhite:'#a6adc8' },
  },
  {
    id: 'dracula', name: 'Dracula', nameEn: 'Dracula', badge: '◈',
    description: '经典暗紫高对比度', builtIn: true,
    terminal: { background:'#282a36', foreground:'#f8f8f2', cursor:'#f8f8f2', cursorAccent:'#282a36', selectionBackground:'#44475a88', black:'#21222c', red:'#ff5555', green:'#50fa7b', yellow:'#f1fa8c', blue:'#bd93f9', magenta:'#ff79c6', cyan:'#8be9fd', white:'#f8f8f2', brightBlack:'#6272a4', brightRed:'#ff6e6e', brightGreen:'#69ff94', brightYellow:'#ffffa5', brightBlue:'#d6acff', brightMagenta:'#ff92df', brightCyan:'#a4ffff', brightWhite:'#ffffff' },
  },
  {
    id: 'nord', name: 'Nord', nameEn: 'Nord', badge: '❄',
    description: '清爽冰蓝，克制极简', builtIn: true,
    terminal: { background:'#2e3440', foreground:'#d8dee9', cursor:'#88c0d0', cursorAccent:'#2e3440', selectionBackground:'#434c5e88', black:'#3b4252', red:'#bf616a', green:'#a3be8c', yellow:'#ebcb8b', blue:'#81a1c1', magenta:'#b48ead', cyan:'#88c0d0', white:'#e5e9f0', brightBlack:'#4c566a', brightRed:'#d08770', brightGreen:'#a3be8c', brightYellow:'#ebcb8b', brightBlue:'#88c0d0', brightMagenta:'#b48ead', brightCyan:'#8fbcbb', brightWhite:'#eceff4' },
  },
];

const STORAGE = 'twui.terminalThemes';
const SELECTED = 'twui.terminalTheme';

export function getTerminalThemes(): TerminalThemeConfig[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    const custom = Array.isArray(raw) ? raw.filter((t) => t && typeof t.id === 'string' && t.builtIn !== true) : [];
    return [...BUILTIN_TERMINAL_THEMES, ...custom.map((t) => ({ ...t, builtIn: false }))];
  } catch { return [...BUILTIN_TERMINAL_THEMES]; }
}

export function getTerminalTheme(id: string): TerminalThemeConfig {
  return getTerminalThemes().find((t) => t.id === id) || BUILTIN_TERMINAL_THEMES[0];
}

export function getSelectedTerminalThemeId(): string {
  const saved = localStorage.getItem(SELECTED);
  if (saved && getTerminalThemes().some((t) => t.id === saved)) return saved;
  // Preserve the old behavior for existing installations once, then become independent.
  const old = localStorage.getItem('twui.theme');
  return old && getTerminalThemes().some((t) => t.id === old) ? old : 'termux-classic';
}

export function saveSelectedTerminalTheme(id: string): void {
  localStorage.setItem(SELECTED, id);
}

export function saveCustomTerminalTheme(theme: TerminalThemeConfig): void {
  const current = getTerminalThemes().filter((t) => !t.builtIn);
  const next = [...current.filter((t) => t.id !== theme.id), { ...theme, builtIn: false }];
  localStorage.setItem(STORAGE, JSON.stringify(next));
}

export function deleteCustomTerminalTheme(id: string): void {
  const next = getTerminalThemes().filter((t) => t.builtIn || t.id !== id);
  localStorage.setItem(STORAGE, JSON.stringify(next));
  if (localStorage.getItem(SELECTED) === id) saveSelectedTerminalTheme('termux-classic');
}

export function exportTerminalTheme(theme: TerminalThemeConfig): void {
  const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `termux-webui-terminal-theme-${theme.id}.json`; a.click();
  URL.revokeObjectURL(url);
}
