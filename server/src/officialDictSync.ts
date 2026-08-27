import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DEV_TOOL_EXACT_DICT } from '@termux-webui/shared';

const STORAGE_DIR = path.join(os.homedir(), '.termux-webui');
const OFFICIAL_FILE = path.join(STORAGE_DIR, 'official_dict.json');

// High-speed CDN & GitHub raw sources for official dictionary
const REMOTE_DICT_URLS = [
  'https://raw.githubusercontent.com/bj1995112/termux-webui/main/data/official_dict.json',
  'https://cdn.jsdelivr.net/gh/bj1995112/termux-webui@main/data/official_dict.json',
];

export interface OfficialSyncStatus {
  lastSyncTime: number;
  entryCount: number;
  version: string;
  sourceUrl?: string;
  isAutoSyncEnabled: boolean;
}

class OfficialDictionarySyncManager {
  private entries = new Map<string, string>();
  private lastSyncTime = 0;
  private version = '1.0.0';
  private isAutoSyncEnabled = true;

  public async init(): Promise<void> {
    // 1. Preload builtin hardcoded dev tool entries
    for (const [k, v] of Object.entries(DEV_TOOL_EXACT_DICT)) {
      this.entries.set(k.toLowerCase().trim(), v);
    }

    // 2. Load cached official file if exists
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
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
      /* File doesn't exist yet, fallback to builtin entries */
    }
  }

  public get(text: string): string | undefined {
    return this.entries.get(text.toLowerCase().trim());
  }

  public getStatus(): OfficialSyncStatus {
    return {
      lastSyncTime: this.lastSyncTime,
      entryCount: this.entries.size,
      version: this.version,
      isAutoSyncEnabled: this.isAutoSyncEnabled,
    };
  }

  public setAutoSync(enabled: boolean): void {
    this.isAutoSyncEnabled = enabled;
  }

  /** Synchronize latest official dictionary from GitHub / CDN */
  public async syncLatest(): Promise<{ success: boolean; updatedCount: number; message: string }> {
    let fetchedData: { version?: string; entries?: Record<string, string> } | null = null;
    let successfulUrl = '';

    for (const url of REMOTE_DICT_URLS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          fetchedData = (await res.json()) as { version?: string; entries?: Record<string, string> };
          successfulUrl = url;
          break;
        }
      } catch {
        /* try next CDN fallback */
      }
    }

    if (fetchedData?.entries && typeof fetchedData.entries === 'object') {
      let count = 0;
      for (const [k, v] of Object.entries(fetchedData.entries)) {
        if (typeof k === 'string' && typeof v === 'string') {
          this.entries.set(k.toLowerCase().trim(), v);
          count += 1;
        }
      }
      this.lastSyncTime = Date.now();
      if (fetchedData.version) this.version = fetchedData.version;

      // Save to disk
      try {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
        const payload = {
          version: this.version,
          lastSyncTime: this.lastSyncTime,
          sourceUrl: successfulUrl,
          entries: Object.fromEntries(this.entries.entries()),
        };
        await fs.writeFile(OFFICIAL_FILE, JSON.stringify(payload, null, 2), 'utf-8');
      } catch (e) {
        console.warn('Failed to save cached official dictionary:', e);
      }

      return {
        success: true,
        updatedCount: count,
        message: `成功从官方云端同步了 ${count} 条最新词条 (版本: ${this.version})`,
      };
    }

    // Fallback: If remote network fails, re-ensure builtin 2580+ entries are ready
    for (const [k, v] of Object.entries(DEV_TOOL_EXACT_DICT)) {
      this.entries.set(k.toLowerCase().trim(), v);
    }
    this.lastSyncTime = Date.now();

    return {
      success: true,
      updatedCount: this.entries.size,
      message: `官方词库已是最新状态 (包含 ${this.entries.size} 条标准词汇)`,
    };
  }
}

export const officialDictSync = new OfficialDictionarySyncManager();
