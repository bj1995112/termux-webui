import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { IPty, spawn } from 'node-pty';
import type { CliId, SessionInfo } from '@termux-webui/shared';
import { commandFor } from './clis.js';

const PROMPT_CONFIG = path.join(homedir(), '.config', 'termux-webui', 'prompt.conf');

export interface Session extends SessionInfo {
  pty?: IPty;
  extraEnv?: Record<string, string>;
}

const DEFAULT_CWD = process.env.AGENTDECK_HOME || homedir();

function resolveCwd(cwd?: string): string {
  const base = cwd ? path.resolve(cwd.replace(/^~(?=\/|$)/, homedir())) : DEFAULT_CWD;
  return existsSync(base) && base.startsWith('/') ? base : DEFAULT_CWD;
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  /** output listeners keyed by sessionId */
  private listeners = new Map<string, Set<(data: string) => void>>();
  private exitListeners = new Map<string, Set<(code: number) => void>>();
  /** rolling output buffer per session */
  private buffers = new Map<string, string>();
  private static MAX_BUFFER = 128 * 1024;

  create(kind: CliId, cwd?: string, extraArgs?: string[], extraEnv?: Record<string, string>, existingId?: string): SessionInfo {
    const id = existingId || randomUUID();
    const dir = resolveCwd(cwd);
    const { file, args } = commandFor(kind, extraArgs);
    const env = {
      ...process.env,
      ...(extraEnv ?? {}),
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      LANG: process.env.LANG || 'C.UTF-8',
      LOCAL_8317_API_KEY: extraEnv?.LOCAL_8317_API_KEY || process.env.LOCAL_8317_API_KEY || '',
    };
    const pty = spawn(file, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: dir,
      env,
    });

    const session: Session = {
      id,
      kind,
      cwd: dir,
      createdAt: Date.now(),
      status: 'running',
      args: extraArgs && extraArgs.length > 0 ? extraArgs : undefined,
      extraEnv,
      pty,
    };
    this.sessions.set(id, session);
    if (!existingId) {
      this.buffers.set(id, '');
    }

    // Shell PTYs remain native Bash sessions; no prompt injection.
    pty.onData((data) => {
      let buf = (this.buffers.get(id) ?? '') + data;
      if (buf.length > SessionManager.MAX_BUFFER * 1.5) {
        buf = buf.slice(-SessionManager.MAX_BUFFER);
      }
      this.buffers.set(id, buf);
      for (const fn of this.listeners.get(id) ?? []) fn(data);
    });

    pty.onExit(({ exitCode }) => {
      session.status = 'exited';
      session.exitCode = exitCode;
      session.pty = undefined;
      for (const fn of this.exitListeners.get(id) ?? []) fn(exitCode);
    });

    const { pty: _pty, ...info } = session;
    void _pty;
    return info;
  }

  restart(id: string): SessionInfo | null {
    const s = this.sessions.get(id);
    if (!s) return null;
    if (s.pty) {
      try {
        s.pty.kill();
      } catch {
        /* ignore */
      }
    }
    return this.create(s.kind, s.cwd, s.args, s.extraEnv, s.id);
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  list(): SessionInfo[] {
    return [...this.sessions.values()].map(({ pty: _pty, ...info }) => {
      void _pty;
      return info;
    });
  }

  setPromptTheme(theme: string, color = 'cyan'): boolean {
    const allowed = new Set(['arrow','powerline','p10k','rainbow','tokyo','dracula','cyber','hud','double','minimal']);
    if (!allowed.has(theme)) return false;
    mkdirSync(path.dirname(PROMPT_CONFIG), { recursive: true });
    const allowedColors = new Set(['cyan','blue','purple','pink','green','yellow','orange','red','white']);
    const safeColor = allowedColors.has(color) ? color : 'cyan';
    writeFileSync(PROMPT_CONFIG, `theme=${theme}\ncolor=${safeColor}\n`, { mode: 0o600 });
    let changed = false;
    for (const session of this.sessions.values()) {
      if (session.kind !== 'shell' || !session.pty) continue;
      try {
        // Readline consumes this private sequence via a binding installed by
        // prompt.sh. This updates PS1 and redraws immediately without entering
        // a shell command or changing the user's current READLINE_LINE.
        session.pty.write('\x1b[99~');
        changed = true;
      } catch {
        // Shell may have exited between lookup and signal.
      }
    }
    return changed;
  }

  write(id: string, data: string): boolean {
    const session = this.sessions.get(id);
    if (!session || !session.pty) return false;
    session.pty.write(data);
    return true;
  }

  resize(id: string, cols: number, rows: number): boolean {
    try {
      this.sessions.get(id)?.pty?.resize(cols, rows);
      return true;
    } catch {
      return false;
    }
  }

  kill(id: string): boolean {
    const s = this.sessions.get(id);
    if (!s) return false;
    if (s.pty) {
      try {
        s.pty.kill();
      } catch {
        /* ignore */
      }
    }
    this.cleanup(id);
    return true;
  }

  onOutput(id: string, fn: (data: string) => void): () => void {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  onExit(id: string, fn: (code: number) => void): () => void {
    let set = this.exitListeners.get(id);
    if (!set) {
      set = new Set();
      this.exitListeners.set(id, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  snapshot(id: string): string {
    return this.buffers.get(id) ?? '';
  }

  private cleanup(id: string) {
    const exitFns = this.exitListeners.get(id);
    if (exitFns) {
      for (const fn of exitFns) fn(0);
    }
    this.sessions.delete(id);
    this.listeners.delete(id);
    this.exitListeners.delete(id);
    this.buffers.delete(id);
  }
}
