import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface LearnedEntry {
  original: string;
  translated: string;
  category?: string;
  hitCount: number;
  createdAt: number;
  lastUsedAt: number;
  source?: string;
}

const STORAGE_DIR = path.join(os.homedir(), '.termux-webui');
const STORAGE_FILE = path.join(STORAGE_DIR, 'learned_dict.json');

class LearnedDictionaryManager {
  private entries = new Map<string, LearnedEntry>();
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private isLoaded = false;

  public async init(): Promise<void> {
    if (this.isLoaded) return;
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      const raw = await fs.readFile(STORAGE_FILE, 'utf-8');
      const list = JSON.parse(raw) as LearnedEntry[];
      for (const item of list) {
        if (item.original && item.translated) {
          this.entries.set(item.original.toLowerCase().trim(), item);
        }
      }
    } catch {
      /* file doesn't exist yet, start with empty map */
    }
    this.isLoaded = true;
  }

  /** Zero-latency 0ms in-memory lookup */
  public get(text: string): LearnedEntry | undefined {
    const key = text.toLowerCase().trim();
    const found = this.entries.get(key);
    if (found) {
      found.hitCount += 1;
      found.lastUsedAt = Date.now();
      this.scheduleSave();
    }
    return found;
  }

  /** Add or update learned translation entry */
  public record(original: string, translated: string, category = 'auto_learned', source = 'auto'): void {
    const origClean = original.trim();
    const transClean = translated.trim();
    if (!origClean || !transClean || origClean === transClean) return;

    const key = origClean.toLowerCase();
    const existing = this.entries.get(key);
    if (existing) {
      existing.translated = transClean;
      existing.hitCount += 1;
      existing.lastUsedAt = Date.now();
      if (source !== 'auto') existing.source = source;
    } else {
      this.entries.set(key, {
        original: origClean,
        translated: transClean,
        category,
        hitCount: 1,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        source,
      });
    }
    this.scheduleSave();
  }

  public setManual(original: string, translated: string, category = 'manual'): void {
    this.record(original, translated, category, 'manual');
  }

  public delete(original: string): boolean {
    const key = original.toLowerCase().trim();
    const deleted = this.entries.delete(key);
    if (deleted) this.scheduleSave();
    return deleted;
  }

  public getAll(): LearnedEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  }

  public count(): number {
    return this.entries.size;
  }

  public clear(): void {
    this.entries.clear();
    this.scheduleSave();
  }

  public importEntries(list: LearnedEntry[]): number {
    let count = 0;
    for (const item of list) {
      if (item.original && item.translated) {
        this.record(item.original, item.translated, item.category || 'imported', item.source || 'imported');
        count += 1;
      }
    }
    return count;
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(async () => {
      this.saveDebounceTimer = null;
      try {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
        const list = Array.from(this.entries.values());
        await fs.writeFile(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf-8');
      } catch (err) {
        console.warn('Failed to save learned dictionary:', err);
      }
    }, 500);
  }
}

export const learnedDict = new LearnedDictionaryManager();
