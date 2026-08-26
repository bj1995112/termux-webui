import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { IPty, spawn } from 'node-pty';
import type { CliId, SessionInfo } from '@termux-webui/shared';
import { commandFor } from './clis.js';

export interface Session extends SessionInfo {
  pty: IPty;
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
  /** rolling output buffer per session, replayed on attach so late joiners
   * (and page reloads) see the prompt and everything before them. */
  private buffers = new Map<string, string>();
  private static MAX_BUFFER = 128 * 1024;

  create(kind: CliId, cwd?: string, extraArgs?: string[], extraEnv?: Record<string, string>): SessionInfo {
    const id = randomUUID();
    const dir = resolveCwd(cwd);
    const { file, args } = commandFor(kind, extraArgs);
    const env = {
      ...process.env,
      ...(extraEnv ?? {}),
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      // Let TUIs know the host so paste/links behave.
      LANG: process.env.LANG || 'C.UTF-8',
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
      pty,
    };
    this.sessions.set(id, session);
    this.buffers.set(id, '');

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
      for (const fn of this.exitListeners.get(id) ?? []) fn(exitCode);
      this.cleanup(id);
    });

    const { pty: _pty, ...info } = session;
    void _pty;
    return info;
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

  write(id: string, data: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.pty.write(data); // node-pty's write returns void — success = no throw
    return true;
  }

  resize(id: string, cols: number, rows: number): boolean {
    try {
      this.sessions.get(id)?.pty.resize(cols, rows);
      return true;
    } catch {
      return false;
    }
  }

  kill(id: string): boolean {
    const s = this.sessions.get(id);
    if (!s) return false;
    s.pty.kill();
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
    this.sessions.delete(id);
    this.listeners.delete(id);
    this.exitListeners.delete(id);
    this.buffers.delete(id);
  }
}
