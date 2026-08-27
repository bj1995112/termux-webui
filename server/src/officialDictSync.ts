import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DEV_TOOL_EXACT_DICT } from '@termux-webui/shared';
import { translate } from './translator.js';

const STORAGE_DIR = path.join(os.homedir(), '.termux-webui');
const OFFICIAL_FILE = path.join(STORAGE_DIR, 'official_dict.json');
const SOURCES_FILE = path.join(STORAGE_DIR, 'custom_sources.json');

// High-speed CDN & GitHub raw sources for official dictionary
const REMOTE_DICT_URLS = [
  'https://raw.githubusercontent.com/bj1995112/termux-webui/main/data/official_dict.json',
  'https://cdn.jsdelivr.net/gh/bj1995112/termux-webui@main/data/official_dict.json',
];

export interface CustomSourceRepo {
  id: string;
  name: string;
  url: string; // GitHub repo or local path
  description?: string;
  lastScannedAt?: number;
  extractedCount?: number;
}

export interface CommandStudioStatus {
  lastSyncTime: number;
  entryCount: number;
  version: string;
  sources: CustomSourceRepo[];
}

const DEFAULT_SOURCES: CustomSourceRepo[] = [
  { id: 'codex', name: 'OpenAI Codex CLI', url: 'https://github.com/openai/codex' },
  { id: 'claude', name: 'Anthropic Claude Code', url: 'https://github.com/anthropics/claude-code' },
  { id: 'aider', name: 'Aider AI Pair Programmer', url: 'https://github.com/paul-gauthier/aider' },
  { id: 'cursor', name: 'Cursor CLI & Rules', url: 'https://github.com/getcursor/cursor' },
  { id: 'opencode', name: 'OpenCode TUI', url: 'https://github.com/opencode-ai/opencode' },
];

class CommandStudioManager {
  private entries = new Map<string, string>();
  private sources: CustomSourceRepo[] = [...DEFAULT_SOURCES];
  private lastSyncTime = 0;
  private version = '1.4.0';

  public async init(): Promise<void> {
    // 1. Preload builtin hardcoded dev tool entries
    for (const [k, v] of Object.entries(DEV_TOOL_EXACT_DICT)) {
      this.entries.set(k.toLowerCase().trim(), v);
    }

    await fs.mkdir(STORAGE_DIR, { recursive: true });

    // 2. Load cached official file if exists
    try {
      const raw = await fs.readFile(OFFICIAL_FILE, 'utf-8');
      const data = JSON.parse(raw) as { version?: string; lastSyncTime?: number; entries?: Record<string, string> };
      if (data.entries && typeof data.entries === 'object') {
        for (const [k, v] of Object.entries(data.entries)) {
          if (typeof k === 'string' && typeof v === 'string') {
            this.entries.set(k.toLowerCase().trim(), v);
          }
        }
      }
      if (data.lastSyncTime) this.lastSyncTime = data.lastSyncTime;
      if (data.version) this.version = data.version;
    } catch {
      /* File doesn't exist yet */
    }

    // 3. Load custom sources
    try {
      const rawSources = await fs.readFile(SOURCES_FILE, 'utf-8');
      const parsed = JSON.parse(rawSources) as CustomSourceRepo[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.sources = parsed;
      }
    } catch {
      /* write default */
      await this.persistSources();
    }
  }

  public get(text: string): string | undefined {
    return this.entries.get(text.toLowerCase().trim());
  }

  public getAllEntries(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of this.entries.entries()) {
      result[k] = v;
    }
    return result;
  }

  public getStatus(): CommandStudioStatus {
    return {
      lastSyncTime: this.lastSyncTime,
      entryCount: this.entries.size,
      version: this.version,
      sources: this.sources,
    };
  }

  public async addSource(name: string, url: string, description?: string): Promise<CustomSourceRepo> {
    const newSource: CustomSourceRepo = {
      id: `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      url: url.trim(),
      description: description?.trim(),
      lastScannedAt: Date.now(),
      extractedCount: 0,
    };
    this.sources.push(newSource);
    await this.persistSources();
    return newSource;
  }

  public async removeSource(id: string): Promise<boolean> {
    const prevLen = this.sources.length;
    this.sources = this.sources.filter((s) => s.id !== id);
    if (this.sources.length !== prevLen) {
      await this.persistSources();
      return true;
    }
    return false;
  }

  private async persistSources(): Promise<void> {
    try {
      await fs.writeFile(SOURCES_FILE, JSON.stringify(this.sources, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save sources:', e);
    }
  }

  private async persistEntries(): Promise<void> {
    try {
      const obj = this.getAllEntries();
      const payload = {
        version: this.version,
        lastSyncTime: this.lastSyncTime,
        description: 'Termux WebUI Standard AI CLI Commands',
        entries: obj,
      };
      await fs.writeFile(OFFICIAL_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save official dict:', e);
    }
  }

  /**
   * One-click incremental sync: pulls latest remote dictionary diff, translates new commands, and merges.
   */
  public async syncLatest(): Promise<{ success: boolean; newAddedCount: number; message: string }> {
    let fetchedData: { version?: string; entries?: Record<string, string> } | null = null;

    for (const url of REMOTE_DICT_URLS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          fetchedData = (await res.json()) as { version?: string; entries?: Record<string, string> };
          break;
        }
      } catch {
        /* try next fallback */
      }
    }

    let newCount = 0;
    if (fetchedData?.entries && typeof fetchedData.entries === 'object') {
      for (const [k, v] of Object.entries(fetchedData.entries)) {
        const key = k.toLowerCase().trim();
        if (!this.entries.has(key)) {
          this.entries.set(key, v);
          newCount += 1;
        }
      }
      this.lastSyncTime = Date.now();
      if (fetchedData.version) this.version = fetchedData.version;
      await this.persistEntries();
    }

    return {
      success: true,
      newAddedCount: newCount,
      message: newCount > 0 ? `成功增量同步 ${newCount} 条全新 AI 命令！` : '已是全网最新版本，未发现新命令。',
    };
  }

  /**
   * Mines slash commands from raw text or markdown code, translates description to Chinese, and adds to dictionary.
   */
  public async mineAndIngestText(rawContent: string): Promise<{ added: Array<{ cmd: string; zh: string }> }> {
    const added: Array<{ cmd: string; zh: string }> = [];

    // Regex to match slash commands like `/plan - switch to plan mode` or `command('/compact').desc('...')`
    const patterns = [
      /(\/[a-zA-Z0-9_-]{2,20})\s*[-:—]\s*([^\r\n]+)/g,
      /command\(['"](\/[a-zA-Z0-9_-]{2,20})['"]\)[^)]*description\(['"]([^'"]+)['"]\)/g,
      /{\s*name:\s*['"](\/?[a-zA-Z0-9_-]{2,20})['"],\s*description:\s*['"]([^'"]+)['"]/g,
    ];

    for (const pat of patterns) {
      let m: RegExpExecArray | null;
      while ((m = pat.exec(rawContent)) !== null) {
        let cmd = m[1].trim();
        if (!cmd.startsWith('/')) cmd = `/${cmd}`;
        const rawDesc = m[2].trim();
        const key = cmd.toLowerCase();

        if (rawDesc.length >= 3 && !this.entries.has(key)) {
          // Translate to Chinese
          let zhDesc = rawDesc;
          try {
            zhDesc = await translate(rawDesc);
          } catch {
            /* fallback to raw */
          }

          const fullEntry = `${cmd} ${zhDesc}`;
          this.entries.set(key, fullEntry);
          added.push({ cmd, zh: fullEntry });
        }
      }
    }

    if (added.length > 0) {
      this.lastSyncTime = Date.now();
      await this.persistEntries();
    }

    return { added };
  }
}

export const officialDictSync = new CommandStudioManager();
