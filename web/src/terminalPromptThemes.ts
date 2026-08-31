export interface TerminalPromptTheme { id: string; name: string; sample: string; description: string; }

export const TERMINAL_PROMPT_COLORS = [
  { id: 'cyan', name: '青色', ansi: 45, hex: '#00d7ff' },
  { id: 'blue', name: '蓝色', ansi: 81, hex: '#5fd7ff' },
  { id: 'purple', name: '紫色', ansi: 141, hex: '#af87ff' },
  { id: 'pink', name: '粉色', ansi: 213, hex: '#ff87ff' },
  { id: 'green', name: '绿色', ansi: 48, hex: '#00ff87' },
  { id: 'yellow', name: '黄色', ansi: 220, hex: '#ffd700' },
  { id: 'orange', name: '橙色', ansi: 208, hex: '#ff8700' },
  { id: 'red', name: '红色', ansi: 203, hex: '#ff5f5f' },
  { id: 'white', name: '白色', ansi: 255, hex: '#eeeeee' },
];

export const TERMINAL_PROMPT_THEMES: TerminalPromptTheme[] = [
  { id: 'arrow', name: '长箭头', sample: '╰─➤ command', description: '长箭头 + 路径，最接近你要的效果' },
  { id: 'powerline', name: 'Powerline', sample: '❯ command', description: '经典 Powerline 箭头分隔' },
  { id: 'p10k', name: 'P10k Modern', sample: 'root  ~/project  ❯ command', description: 'Powerlevel10k 现代风格' },
  { id: 'rainbow', name: 'P10k Rainbow', sample: 'root  ~/project  git:main  ❯ command', description: '多段彩色信息' },
  { id: 'tokyo', name: 'Tokyo', sample: '└─➤ command', description: 'Tokyo Night 风格的蓝紫箭头' },
  { id: 'dracula', name: 'Dracula', sample: '└─➤ command', description: 'Dracula 暗紫高对比' },
  { id: 'cyber', name: 'Cyber', sample: '━━━➤ command', description: '赛博长线箭头' },
  { id: 'hud', name: 'HUD', sample: '[root@ubuntu] ━➤ command', description: '科技 HUD 双段提示' },
  { id: 'double', name: '双行', sample: '╭─ root@ubuntu ~/project\n╰─➤ command', description: '两行信息 + 箭头' },
  { id: 'minimal', name: '极简', sample: '➜ command', description: '最简洁的彩色箭头' },
];
