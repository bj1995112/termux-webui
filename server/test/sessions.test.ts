import { describe, it, expect, afterAll } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { SessionManager } from '../src/sessions.js';

const manager = new SessionManager();
const cwd = os.tmpdir();
const spawned: string[] = [];

afterAll(() => {
  for (const id of spawned) manager.kill(id);
});

function makeShell() {
  const info = manager.create('shell', cwd);
  spawned.push(info.id);
  return info;
}

describe('SessionManager', () => {
  it('creates a shell session in the requested cwd', () => {
    const info = makeShell();
    expect(info.kind).toBe('shell');
    expect(path.resolve(info.cwd)).toBe(path.resolve(cwd));
    expect(manager.get(info.id)?.pty).toBeTruthy();
  });

  it('falls back to a safe cwd when the given one does not exist', () => {
    const info = manager.create('shell', '/definitely/not/a/real/dir');
    spawned.push(info.id);
    expect(existsSync(info.cwd)).toBe(true);
  });

  it('writes to the pty and lists sessions', async () => {
    const info = makeShell();
    expect(manager.write(info.id, 'echo hi\r')).toBe(true);
    await new Promise((r) => setTimeout(r, 300));
    const listed = manager.list().find((s) => s.id === info.id);
    expect(listed?.kind).toBe('shell');
  });

  it('streams output to listeners', async () => {
    const info = makeShell();
    let got = '';
    const off = manager.onOutput(info.id, (d) => (got += d));
    manager.write(info.id, 'echo termux-webui-test-1234\r');
    await new Promise((r) => setTimeout(r, 800));
    off();
    expect(got).toContain('termux-webui-test-1234');
  });

  it('kills a session and reports exit', async () => {
    const info = makeShell();
    const exited = new Promise<number>((resolve) => {
      manager.onExit(info.id, resolve);
      setTimeout(() => resolve(-1), 2000);
    });
    expect(manager.kill(info.id)).toBe(true);
    expect(await exited).not.toBe(-1);
    expect(manager.get(info.id)).toBeUndefined();
  });

  it('rejects writes to unknown sessions', () => {
    expect(manager.write('nope', 'x')).toBe(false);
  });

  it('supports custom environment variables and arguments', async () => {
    const info = manager.create('shell', cwd, undefined, { TEST_VAR_ABC: 'custom_value_123' });
    spawned.push(info.id);
    let got = '';
    const off = manager.onOutput(info.id, (d) => (got += d));
    manager.write(info.id, 'echo "VAR=$TEST_VAR_ABC"\r');
    await new Promise((r) => setTimeout(r, 600));
    off();
    expect(got).toContain('VAR=custom_value_123');
  });

  it('stores and retrieves snapshot buffer', async () => {
    const info = makeShell();
    manager.write(info.id, 'echo snapshot_check_456\r');
    await new Promise((r) => setTimeout(r, 600));
    const snap = manager.snapshot(info.id);
    expect(snap).toContain('snapshot_check_456');
  });
});

