import type { TerminalThemeConfig } from './terminalTheme';

export interface OnlineTerminalTheme {
  id: string;
  name: string;
  source: 'iTerm2 Color Schemes';
  sourceUrl: string;
  fileUrl: string;
  format: 'termux-properties';
  description?: string;
}

const SOURCE = 'https://github.com/mbadolato/iTerm2-Color-Schemes';
const RAW = 'https://raw.githubusercontent.com/mbadolato/iTerm2-Color-Schemes/master/termux';

export const ONLINE_TERMINAL_THEMES: OnlineTerminalTheme[] = [
  { id: 'dracula', name: 'Dracula', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Dracula.properties`, format: 'termux-properties', description: '经典暗紫高对比' },
  { id: 'nord', name: 'Nord', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Nord.properties`, format: 'termux-properties', description: '清爽冰蓝' },
  { id: 'tokyonight', name: 'Tokyo Night', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/TokyoNight.properties`, format: 'termux-properties', description: '深蓝紫现代风格' },
  { id: 'gruvboxdark', name: 'Gruvbox Dark', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/GruvboxDark.properties`, format: 'termux-properties', description: '暖色复古深色主题' },
  { id: 'monokai', name: 'Monokai', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Monokai.properties`, format: 'termux-properties', description: '经典代码配色' },
  { id: 'solarizeddark', name: 'Solarized Dark', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/SolarizedDark.properties`, format: 'termux-properties', description: '经典低对比深色' },
  { id: 'onedark', name: 'One Dark', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/OneDark.properties`, format: 'termux-properties', description: '现代开发者深色' },
  { id: 'onehalfdark', name: 'One Half Dark', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/OneHalfDark.properties`, format: 'termux-properties', description: '柔和深色' },
  { id: 'material', name: 'Material', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Material.properties`, format: 'termux-properties', description: 'Material Design 风格' },
  { id: 'ocean', name: 'Ocean', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Ocean.properties`, format: 'termux-properties', description: '深海蓝色' },
  { id: 'afterglow', name: 'Afterglow', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Afterglow.properties`, format: 'termux-properties', description: '柔和深色' },
  { id: 'argonaut', name: 'Argonaut', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Argonaut.properties`, format: 'termux-properties', description: '深色高对比' },
  { id: 'arthur', name: 'Arthur', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Arthur.properties`, format: 'termux-properties', description: '暖色暗调' },
  { id: 'aurora', name: 'Aurora', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Aurora.properties`, format: 'termux-properties', description: '冷色渐变风格' },
  { id: 'batman', name: 'Batman', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Batman.properties`, format: 'termux-properties', description: '黑灰黄高对比' },
  { id: 'belafonte-day', name: 'Belafonte Day', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Belafonte Day.properties`, format: 'termux-properties', description: '复古浅色' },
  { id: 'belafonte-night', name: 'Belafonte Night', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Belafonte Night.properties`, format: 'termux-properties', description: '复古深色' },
  { id: 'birdsofparadise', name: 'Birds of Paradise', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/BirdsOfParadise.properties`, format: 'termux-properties', description: '暖色自然风格' },
  { id: 'blazer', name: 'Blazer', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Blazer.properties`, format: 'termux-properties', description: '蓝色深色' },
  { id: 'blue-matrix', name: 'Blue Matrix', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Blue Matrix.properties`, format: 'termux-properties', description: '蓝色黑底' },
  { id: 'builtin-dark', name: 'Builtin Dark', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Builtin Dark.properties`, format: 'termux-properties', description: '经典深色' },
  { id: 'builtin-light', name: 'Builtin Light', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Builtin Light.properties`, format: 'termux-properties', description: '经典浅色' },
  { id: 'builtin-pastel-dark', name: 'Builtin Pastel Dark', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Builtin Pastel Dark.properties`, format: 'termux-properties', description: '柔和深色' },
  { id: 'builtin-solarized-dark', name: 'Builtin Solarized Dark', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Builtin Solarized Dark.properties`, format: 'termux-properties', description: 'Solarized 深色' },
  { id: 'builtin-solarized-light', name: 'Builtin Solarized Light', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Builtin Solarized Light.properties`, format: 'termux-properties', description: 'Solarized 浅色' },
  { id: 'cobalt2', name: 'Cobalt2', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Cobalt2.properties`, format: 'termux-properties', description: '蓝色开发主题' },
  { id: 'crayonponyfish', name: 'Crayon Pony Fish', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/CrayonPonyFish.properties`, format: 'termux-properties', description: '彩色柔和' },
  { id: 'darkside', name: 'Darkside', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Darkside.properties`, format: 'termux-properties', description: '深色高对比' },
  { id: 'dimmed-monokai', name: 'Dimmed Monokai', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Dimmed Monokai.properties`, format: 'termux-properties', description: '低亮 Monokai' },
  { id: 'espresso', name: 'Espresso', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Espresso.properties`, format: 'termux-properties', description: '咖啡色调' },
  { id: 'flat', name: 'Flat', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Flat.properties`, format: 'termux-properties', description: '扁平深色' },
  { id: 'funforrest', name: 'FunForrest', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/FunForrest.properties`, format: 'termux-properties', description: '森林绿色' },
  { id: 'grape', name: 'Grape', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Grape.properties`, format: 'termux-properties', description: '紫色深色' },
  { id: 'hardcore', name: 'Hardcore', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Hardcore.properties`, format: 'termux-properties', description: '高对比深色' },
  { id: 'horizon', name: 'Horizon', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Horizon.properties`, format: 'termux-properties', description: '现代暖色' },
  { id: 'hurtado', name: 'Hurtado', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Hurtado.properties`, format: 'termux-properties', description: '经典深色' },
  { id: 'hyper', name: 'Hyper', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Hyper.properties`, format: 'termux-properties', description: '现代紫色' },
  { id: 'jackie-brown', name: 'Jackie Brown', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Jackie Brown.properties`, format: 'termux-properties', description: '棕色复古' },
  { id: 'japanesque', name: 'Japanesque', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Japanesque.properties`, format: 'termux-properties', description: '日式柔和' },
  { id: 'jubi', name: 'Jubi', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Jubi.properties`, format: 'termux-properties', description: '紫红深色' },
  { id: 'laser', name: 'Laser', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Laser.properties`, format: 'termux-properties', description: '霓虹深色' },
  { id: 'lavandula', name: 'Lavandula', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Lavandula.properties`, format: 'termux-properties', description: '薰衣草紫' },
  { id: 'liquidcarbon', name: 'Liquid Carbon', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/LiquidCarbon.properties`, format: 'termux-properties', description: '碳黑深色' },
  { id: 'man-page', name: 'Man Page', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Man Page.properties`, format: 'termux-properties', description: '终端手册风格' },
  { id: 'misterioso', name: 'Misterioso', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Misterioso.properties`, format: 'termux-properties', description: '神秘紫蓝' },
  { id: 'molokai', name: 'Molokai', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Molokai.properties`, format: 'termux-properties', description: '经典深色' },
  { id: 'monalisa', name: 'Mona Lisa', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/MonaLisa.properties`, format: 'termux-properties', description: '暖色高对比' },
  { id: 'moonlight', name: 'Moonlight', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Moonlight.properties`, format: 'termux-properties', description: '月光蓝紫' },
  { id: 'n0tch2k', name: 'N0tch2k', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/N0tch2k.properties`, format: 'termux-properties', description: '黑灰深色' },
  { id: 'neon', name: 'Neon', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Neon.properties`, format: 'termux-properties', description: '霓虹色' },
  { id: 'night-owl', name: 'Night Owl', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Night Owl.properties`, format: 'termux-properties', description: '护眼深蓝' },
  { id: 'oceanicmaterial', name: 'Oceanic Material', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/OceanicMaterial.properties`, format: 'termux-properties', description: '海洋蓝' },
  { id: 'ollie', name: 'Ollie', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Ollie.properties`, format: 'termux-properties', description: '明亮深色' },
  { id: 'palenight', name: 'Palenight', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Palenight.properties`, format: 'termux-properties', description: '柔和紫蓝' },
  { id: 'panda', name: 'Panda', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Panda.properties`, format: 'termux-properties', description: '黑白粉彩' },
  { id: 'paraiso-dark', name: 'Paraiso Dark', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Paraiso Dark.properties`, format: 'termux-properties', description: '复古深色' },
  { id: 'paulmillr', name: 'Paul Millr', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/PaulMillr.properties`, format: 'termux-properties', description: '彩色深色' },
  { id: 'pencildark', name: 'Pencil Dark', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/PencilDark.properties`, format: 'termux-properties', description: '铅笔深色' },
  { id: 'pencillight', name: 'Pencil Light', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/PencilLight.properties`, format: 'termux-properties', description: '铅笔浅色' },
  { id: 'piatto-light', name: 'Piatto Light', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Piatto Light.properties`, format: 'termux-properties', description: '简洁浅色' },
  { id: 'primary', name: 'Primary', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Primary.properties`, format: 'termux-properties', description: '高对比基础' },
  { id: 'purple-rain', name: 'Purple Rain', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Purple Rain.properties`, format: 'termux-properties', description: '紫色雨夜' },
  { id: 'rebecca', name: 'Rebecca', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Rebecca.properties`, format: 'termux-properties', description: '紫色深色' },
  { id: 'red-alert', name: 'Red Alert', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Red Alert.properties`, format: 'termux-properties', description: '红色高对比' },
  { id: 'royal', name: 'Royal', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Royal.properties`, format: 'termux-properties', description: '皇家紫' },
  { id: 'seashells', name: 'SeaShells', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/SeaShells.properties`, format: 'termux-properties', description: '海洋暖色' },
  { id: 'seti', name: 'Seti', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Seti.properties`, format: 'termux-properties', description: '深蓝灰' },
  { id: 'shaman', name: 'Shaman', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Shaman.properties`, format: 'termux-properties', description: '自然绿色' },
  { id: 'slate', name: 'Slate', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Slate.properties`, format: 'termux-properties', description: '灰蓝深色' },
  { id: 'smyck', name: 'Smyck', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Smyck.properties`, format: 'termux-properties', description: '现代深色' },
  { id: 'softserver', name: 'Soft Server', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/SoftServer.properties`, format: 'termux-properties', description: '柔和终端' },
  { id: 'spacegray', name: 'SpaceGray', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/SpaceGray.properties`, format: 'termux-properties', description: '太空灰' },
  { id: 'spacedust', name: 'Spacedust', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Spacedust.properties`, format: 'termux-properties', description: '复古太空' },
  { id: 'subliminal', name: 'Subliminal', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Subliminal.properties`, format: 'termux-properties', description: '低调深色' },
  { id: 'sundried', name: 'Sundried', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Sundried.properties`, format: 'termux-properties', description: '暖棕色' },
  { id: 'symfonic', name: 'Symfonic', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Symfonic.properties`, format: 'termux-properties', description: '青绿色' },
  { id: 'tango-adapted', name: 'Tango Adapted', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Tango Adapted.properties`, format: 'termux-properties', description: '经典 Tango' },
  { id: 'tango-half-adapted', name: 'Tango Half Adapted', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Tango Half Adapted.properties`, format: 'termux-properties', description: 'Tango 半调' },
  { id: 'tangoesque', name: 'Tangoesque', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Tangoesque.properties`, format: 'termux-properties', description: 'Tango 风格' },
  { id: 'teerb', name: 'Teerb', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Teerb.properties`, format: 'termux-properties', description: '深色复古' },
  { id: 'thayer-bright', name: 'Thayer Bright', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Thayer Bright.properties`, format: 'termux-properties', description: '明亮深色' },
  { id: 'the-hulk', name: 'The Hulk', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/The Hulk.properties`, format: 'termux-properties', description: '绿色高对比' },
  { id: 'tinacious-design', name: 'Tinacious Design', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Tinacious Design.properties`, format: 'termux-properties', description: '设计师深色' },
  { id: 'tomorrow', name: 'Tomorrow', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Tomorrow.properties`, format: 'termux-properties', description: '柔和现代' },
  { id: 'tomorrow-night', name: 'Tomorrow Night', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Tomorrow Night.properties`, format: 'termux-properties', description: '现代深色' },
  { id: 'tomorrow-night-blue', name: 'Tomorrow Night Blue', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Tomorrow Night Blue.properties`, format: 'termux-properties', description: '蓝色深色' },
  { id: 'tomorrow-night-bright', name: 'Tomorrow Night Bright', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Tomorrow Night Bright.properties`, format: 'termux-properties', description: '明亮深色' },
  { id: 'tomorrow-night-burns', name: 'Tomorrow Night Burns', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Tomorrow Night Burns.properties`, format: 'termux-properties', description: '暖色深色' },
  { id: 'toychest', name: 'Toy Chest', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/ToyChest.properties`, format: 'termux-properties', description: '彩色复古' },
  { id: 'treehouse', name: 'Treehouse', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Treehouse.properties`, format: 'termux-properties', description: '森林棕绿' },
  { id: 'twilight', name: 'Twilight', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Twilight.properties`, format: 'termux-properties', description: '暮色紫' },
  { id: 'urple', name: 'Urple', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Urple.properties`, format: 'termux-properties', description: '紫色深色' },
  { id: 'vaughn', name: 'Vaughn', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Vaughn.properties`, format: 'termux-properties', description: '经典深色' },
  { id: 'vibrant-ink', name: 'Vibrant Ink', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Vibrant Ink.properties`, format: 'termux-properties', description: '高饱和开发色' },
  { id: 'warmneon', name: 'Warm Neon', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/WarmNeon.properties`, format: 'termux-properties', description: '暖色霓虹' },
  { id: 'wez', name: 'Wez', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Wez.properties`, format: 'termux-properties', description: '深色彩色' },
  { id: 'whimsy', name: 'Whimsy', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Whimsy.properties`, format: 'termux-properties', description: '梦幻彩色' },
  { id: 'wombat', name: 'Wombat', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Wombat.properties`, format: 'termux-properties', description: '暖灰深色' },
  { id: 'wryan', name: 'Wryan', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Wryan.properties`, format: 'termux-properties', description: '经典彩色' },
  { id: 'zenburn', name: 'Zenburn', source: 'iTerm2 Color Schemes', sourceUrl: SOURCE, fileUrl: `${RAW}/Zenburn.properties`, format: 'termux-properties', description: '低亮护眼' },
];

const norm = (v: unknown, fallback: string) => typeof v === 'string' && /^#[0-9a-fA-F]{6,8}$/.test(v) ? v : fallback;

const parseProperties = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*=\s*(#[0-9a-fA-F]{6,8})\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
};

export function termuxPropertiesToTerminalTheme(text: string, meta: OnlineTerminalTheme): TerminalThemeConfig {
  const c = parseProperties(text);
  const g = (key: string, fallback: string) => norm(c[key], fallback);
  const bg = g('background', '#000000');
  const fg = g('foreground', '#ffffff');
  return {
    id: `online-${meta.id}`, name: meta.name, nameEn: meta.name, badge: '↓',
    description: meta.description || '在线 Termux 主题', builtIn: false,
    terminal: {
      background: bg, foreground: fg, cursor: g('cursor', fg), cursorAccent: bg, selectionBackground: `${fg}33`,
      black: g('color0', '#000000'), red: g('color1', '#ff5555'), green: g('color2', '#55ff55'), yellow: g('color3', '#ffff55'), blue: g('color4', '#5555ff'), magenta: g('color5', '#ff55ff'), cyan: g('color6', '#55ffff'), white: g('color7', '#ffffff'),
      brightBlack: g('color8', '#555555'), brightRed: g('color9', '#ff5555'), brightGreen: g('color10', '#55ff55'), brightYellow: g('color11', '#ffff55'), brightBlue: g('color12', '#5555ff'), brightMagenta: g('color13', '#ff55ff'), brightCyan: g('color14', '#55ffff'), brightWhite: g('color15', '#ffffff'),
    },
  };
}

export async function downloadOnlineTerminalTheme(meta: OnlineTerminalTheme): Promise<TerminalThemeConfig> {
  const res = await fetch(meta.fileUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`主题下载失败 (${res.status})`);
  return termuxPropertiesToTerminalTheme(await res.text(), meta);
}
