import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { CliId, CliInfo } from '@termux-webui/shared';

const HOME = homedir();

export const EXTENDED_PATH = [
  path.join(HOME, '.local/bin'),
  path.join(HOME, '.cargo/bin'),
  path.join(HOME, '.npm-global/bin'),
  path.join(HOME, '.gemini/antigravity-cli/bin'),
  '/data/data/com.termux/files/usr/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  process.env.PATH || '',
].join(':');

const REGISTRY: Array<{ id: CliId; label: string; bin: string; fallbackBins?: string[] }> = [
  { id: 'shell', label: '终端 (Shell)', bin: '' },
  { id: 'codex', label: 'Codex', bin: 'codex', fallbackBins: ['codex-zh', 'codex'] },
  { id: 'pi', label: 'Pi Coding Agent', bin: 'pi' },
  { id: 'agy', label: 'Antigravity (Agy)', bin: 'agy' },
  { id: 'claude', label: 'Claude Code', bin: 'claude' },
  { id: 'opencode', label: 'OpenCode', bin: 'opencode' },
  { id: 'openclaw', label: 'OpenClaw', bin: 'openclaw' },
  { id: 'hermes', label: 'Hermes', bin: 'hermes' },
];

export function which(bin: string): string | undefined {
  if (!bin) return undefined;
  if (bin.startsWith('/') && existsSync(bin)) return bin;

  const res = spawnSync('which', [bin], {
    encoding: 'utf8',
    env: { ...process.env, PATH: EXTENDED_PATH },
  });
  if (res.status === 0 && res.stdout.trim()) {
    return res.stdout.trim();
  }

  // Fallback explicit check in known directories
  for (const p of EXTENDED_PATH.split(':')) {
    if (!p) continue;
    const candidate = path.join(p, bin);
    if (existsSync(candidate)) return candidate;
  }

  return undefined;
}

export function listClis(): CliInfo[] {
  return REGISTRY.map(({ id, label, bin, fallbackBins }) => {
    if (!bin) return { id, label, available: true };
    let resolved = which(bin);
    if (!resolved && fallbackBins) {
      for (const fb of fallbackBins) {
        resolved = which(fb);
        if (resolved) break;
      }
    }
    return { id, label, available: Boolean(resolved), path: resolved };
  });
}

/** Spawn argv for a kind. Shell uses the user's login shell; agents run bare
 * so their own TUI/REPL drives the session. */
export function commandFor(kind: CliId, extraArgs?: string[]): { file: string; args: string[] } {
  const custom = (extraArgs ?? []).filter(Boolean);
  if (kind === 'shell') {
    const shell = process.env.SHELL || '/bin/bash';
    return { file: shell, args: custom.length > 0 ? ['-l', ...custom] : ['-l'] };
  }
  const info = REGISTRY.find((r) => r.id === kind)!;
  let resolved = which(info.bin);
  if (!resolved && info.fallbackBins) {
    for (const fb of info.fallbackBins) {
      resolved = which(fb);
      if (resolved) break;
    }
  }
  return { file: resolved || info.bin, args: custom };
}
