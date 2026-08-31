import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { CliId, CliInfo } from '@termux-webui/shared';

const HOME = homedir();

/**
 * Build the executable search path at runtime. Do not hard-code an individual
 * installation location (e.g. /usr/local/bin/pi): npm/pnpm/Termux installs
 * can move the launcher between global bin directories.
 */
function buildSearchPath(): string[] {
  const dirs = [
    ...(process.env.PATH || '').split(':'),
    path.join(HOME, '.local/bin'),
    path.join(HOME, '.npm-global/bin'),
    path.join(HOME, '.cargo/bin'),
    path.join(HOME, '.gemini/antigravity-cli/bin'),
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/data/data/com.termux/files/usr/bin',
  ];

  // npm's global prefix is installation-dependent. Discover it instead of
  // assuming /usr or /usr/local.
  try {
    const prefix = execFileSync('npm', ['prefix', '-g'], {
      encoding: 'utf8',
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
    if (prefix) dirs.push(path.join(prefix, 'bin'));
  } catch {
    // npm is optional; the normal PATH scan is sufficient.
  }

  return [...new Set(dirs.filter(Boolean))];
}

export const EXTENDED_PATH = buildSearchPath().join(':');

interface CliDefinition {
  id: CliId;
  label: string;
  /** Preferred command name followed by known aliases. */
  commands: string[];
}

/**
 * Known interactive coding agents. The registry describes *what* to detect,
 * not *where* it is installed. This makes the list self-discovering while
 * keeping arbitrary shell commands out of the AI-agent selector.
 */
const DEFINITIONS: CliDefinition[] = [
  { id: 'shell', label: '终端 (Shell)', commands: [] },
  { id: 'pi', label: 'Pi Coding Agent', commands: ['pi', 'pi-coding-agent'] },
  { id: 'codex', label: 'Codex', commands: ['codex', 'codex-zh'] },
  { id: 'agy', label: 'Antigravity (Agy)', commands: ['agy', 'antigravity'] },
  { id: 'claude', label: 'Claude Code', commands: ['claude'] },
  { id: 'opencode', label: 'OpenCode', commands: ['opencode'] },
  { id: 'openclaw', label: 'OpenClaw', commands: ['openclaw'] },
  { id: 'hermes', label: 'Hermes', commands: ['hermes'] },
];

function isExecutable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a command exactly as the session launcher will resolve it. */
export function which(bin: string): string | undefined {
  if (!bin) return undefined;
  if (bin.startsWith('/')) return isExecutable(bin) ? bin : undefined;

  for (const dir of buildSearchPath()) {
    const candidate = path.join(dir, bin);
    if (isExecutable(candidate)) return candidate;
  }

  return undefined;
}

function resolveDefinition(def: CliDefinition): string | undefined {
  for (const command of def.commands) {
    const resolved = which(command);
    if (resolved) return resolved;
  }
  return undefined;
}

/**
 * Discover installed agent CLIs on every request. No restart is required when
 * a CLI is installed/removed while WebUI is running.
 */
export function listClis(): CliInfo[] {
  return DEFINITIONS.map(({ id, label }) => {
    if (id === 'shell') return { id, label, available: true };
    const resolved = resolveDefinition(DEFINITIONS.find((d) => d.id === id)!);
    return {
      id,
      label,
      available: Boolean(resolved),
      ...(resolved ? { path: resolved } : {}),
    };
  });
}

/** Resolve the same executable used by listClis(), immediately before spawn. */
export function commandFor(kind: CliId, extraArgs?: string[]): { file: string; args: string[] } {
  const custom = (extraArgs ?? []).filter(Boolean);

  if (kind === 'shell') {
    const shell = process.env.SHELL || '/bin/bash';
    return { file: shell, args: custom.length > 0 ? ['-l', ...custom] : ['-l'] };
  }

  const definition = DEFINITIONS.find((d) => d.id === kind);
  if (!definition) throw new Error(`Unknown CLI: ${kind}`);

  const resolved = resolveDefinition(definition);
  if (!resolved) {
    throw new Error(`${definition.label} 未安装或当前 WebUI 进程无法找到可执行文件`);
  }

  return { file: resolved, args: custom };
}

/** Diagnostic snapshot used by tests and future UI diagnostics. */
export function discoveredCliPaths(): Record<string, string | undefined> {
  return Object.fromEntries(
    DEFINITIONS.map((d) => [d.id, d.id === 'shell' ? (process.env.SHELL || '/bin/bash') : resolveDefinition(d)]),
  );
}
