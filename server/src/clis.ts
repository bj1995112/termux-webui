import { spawnSync } from 'node:child_process';
import type { CliId, CliInfo } from '@agentdeck/shared';

const REGISTRY: Array<{ id: CliId; label: string; bin: string }> = [
  { id: 'shell', label: '终端', bin: '' },
  { id: 'claude', label: 'Claude Code', bin: 'claude' },
  { id: 'opencode', label: 'OpenCode', bin: 'opencode' },
  { id: 'codex', label: 'Codex', bin: 'codex' },
  { id: 'openclaw', label: 'OpenClaw', bin: 'openclaw' },
  { id: 'hermes', label: 'Hermes', bin: 'hermes' },
];

function which(bin: string): string | undefined {
  const res = spawnSync('which', [bin], { encoding: 'utf8' });
  if (res.status !== 0) return undefined;
  return res.stdout.trim() || undefined;
}

export function listClis(): CliInfo[] {
  return REGISTRY.map(({ id, label, bin }) => {
    if (!bin) return { id, label, available: true };
    const path = which(bin);
    return { id, label, available: Boolean(path), path };
  });
}

/** Spawn argv for a kind. Shell uses the user's login shell; agents run bare
 * so their own TUI/REPL drives the session. */
export function commandFor(kind: CliId): { file: string; args: string[] } {
  if (kind === 'shell') {
    const shell = process.env.SHELL || '/bin/bash';
    return { file: shell, args: ['-l'] };
  }
  const info = REGISTRY.find((r) => r.id === kind)!;
  // Resolve through the login shell so npx-installed CLIs on custom paths work.
  const res = spawnSync('which', [info.bin], { encoding: 'utf8' });
  const path = res.status === 0 ? res.stdout.trim() : info.bin;
  return { file: path || info.bin, args: [] };
}
