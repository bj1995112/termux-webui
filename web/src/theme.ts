import type { ITheme } from '@xterm/xterm';

export type ThemeId = 'tokyo-night' | 'cyber-oled' | 'catppuccin' | 'dracula' | 'nord';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  badge: string;
  description: string;
  terminal: ITheme;
  vars: {
    '--bg-base': string;
    '--bg-panel': string;
    '--bg-panel2': string;
    '--border': string;
    '--text': string;
    '--muted': string;
    '--accent': string;
    '--accent-rgb': string;
    '--accent-hover': string;
  };
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night (东京夜)',
    badge: '🌌',
    description: '深邃蓝紫与极光霓虹，现代 AI 编程首选',
    terminal: {
      background: '#1a1b26',
      foreground: '#c0caf5',
      cursor: '#7aa2f7',
      cursorAccent: '#1a1b26',
      selectionBackground: '#33467c88',
      black: '#15161e',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
      cyan: '#7dcfff',
      white: '#a9b1d6',
      brightBlack: '#414868',
      brightRed: '#f7768e',
      brightGreen: '#9ece6a',
      brightYellow: '#e0af68',
      brightBlue: '#7aa2f7',
      brightMagenta: '#bb9af7',
      brightCyan: '#7dcfff',
      brightWhite: '#c0caf5',
    },
    vars: {
      '--bg-base': '#13141f',
      '--bg-panel': '#1a1b26',
      '--bg-panel2': '#24283b',
      '--border': '#2f354f',
      '--text': '#c0caf5',
      '--muted': '#7aa2f799',
      '--accent': '#7aa2f7',
      '--accent-rgb': '122, 162, 247',
      '--accent-hover': '#89b4fa',
    },
  },
  'cyber-oled': {
    id: 'cyber-oled',
    name: 'Cyber OLED (赛博纯黑)',
    badge: '🖤',
    description: '0 耗电 AMOLED 纯黑，极光高对比度',
    terminal: {
      background: '#000000',
      foreground: '#f0f6fc',
      cursor: '#00f0ff',
      cursorAccent: '#000000',
      selectionBackground: '#00f0ff33',
      black: '#0a0a0c',
      red: '#ff3366',
      green: '#00ff9f',
      yellow: '#ffe600',
      blue: '#00f0ff',
      magenta: '#bd00ff',
      cyan: '#00f0ff',
      white: '#ffffff',
      brightBlack: '#333333',
      brightRed: '#ff5588',
      brightGreen: '#33ffb5',
      brightYellow: '#fff044',
      brightBlue: '#44f4ff',
      brightMagenta: '#d144ff',
      brightCyan: '#44f4ff',
      brightWhite: '#ffffff',
    },
    vars: {
      '--bg-base': '#000000',
      '--bg-panel': '#08080a',
      '--bg-panel2': '#121215',
      '--border': '#222228',
      '--text': '#f0f6fc',
      '--muted': '#8b949e',
      '--accent': '#00f0ff',
      '--accent-rgb': '0, 240, 255',
      '--accent-hover': '#38f9d7',
    },
  },
  catppuccin: {
    id: 'catppuccin',
    name: 'Catppuccin Mocha (摩卡)',
    badge: '☕',
    description: '柔和粉彩与温暖质感，护眼细腻',
    terminal: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selectionBackground: '#585b7066',
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#f5c2e7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8',
    },
    vars: {
      '--bg-base': '#181825',
      '--bg-panel': '#1e1e2e',
      '--bg-panel2': '#313244',
      '--border': '#45475a',
      '--text': '#cdd6f4',
      '--muted': '#a6adc8',
      '--accent': '#cba6f7',
      '--accent-rgb': '203, 166, 247',
      '--accent-hover': '#f5c2e7',
    },
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula (经典德古拉)',
    badge: '🧛',
    description: '传奇暗紫高对比度，经典极客之选',
    terminal: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selectionBackground: '#44475a88',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    },
    vars: {
      '--bg-base': '#1e1f29',
      '--bg-panel': '#282a36',
      '--bg-panel2': '#383a59',
      '--border': '#44475a',
      '--text': '#f8f8f2',
      '--muted': '#6272a4',
      '--accent': '#bd93f9',
      '--accent-rgb': '189, 147, 249',
      '--accent-hover': '#ff79c6',
    },
  },
  nord: {
    id: 'nord',
    name: 'Nord (北欧极光)',
    badge: '🌿',
    description: '极简清爽冰蓝，克制纯粹',
    terminal: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#88c0d0',
      cursorAccent: '#2e3440',
      selectionBackground: '#434c5e88',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#d08770',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#88c0d0',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4',
    },
    vars: {
      '--bg-base': '#242933',
      '--bg-panel': '#2e3440',
      '--bg-panel2': '#3b4252',
      '--border': '#4c566a',
      '--text': '#eceff4',
      '--muted': '#88c0d0aa',
      '--accent': '#88c0d0',
      '--accent-rgb': '136, 192, 208',
      '--accent-hover': '#81a1c1',
    },
  },
};

export function applyTheme(themeId: ThemeId) {
  const config = THEMES[themeId] || THEMES['tokyo-night'];
  const root = document.documentElement;
  for (const [key, val] of Object.entries(config.vars)) {
    root.style.setProperty(key, val);
  }
  // Meta theme-color for browser address bar & PWA
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', config.vars['--bg-panel']);
  }
}
