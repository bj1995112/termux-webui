import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { WebSocketServer, type WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliId, ClientMessage, type CreateSessionBody, type ServerMessage } from '@termux-webui/shared';
import { listClis } from './clis.js';
import { listProjects } from './projects.js';
import { SessionManager } from './sessions.js';
import { listAllConversations, deleteConversation, getConversationDetail } from './history.js';
import { checkPassword, createToken, verifyToken, revokeToken } from './auth.js';
import { translateText } from './translator.js';
import { learnedDict } from './learnedDict.js';
import { officialDictSync } from './officialDictSync.js';

const PORT = Number(process.env.PORT || 4150);
const HOST = process.env.HOST || '0.0.0.0';

export const manager = new SessionManager();

// --- REST -------------------------------------------------------------------

const app = new Hono();

// Auth Endpoints
app.get('/api/auth/status', (c) => c.json({ authRequired: true }));

app.post('/api/auth/login', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password || '';
  if (!checkPassword(password)) {
    return c.json({ ok: false, error: '密码错误' }, 401);
  }
  const token = createToken();
  return c.json({ ok: true, token });
});

app.post('/api/auth/logout', async (c) => {
  const authHeader = c.req.header('authorization') || c.req.header('x-auth-token') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token) revokeToken(token);
  return c.json({ ok: true });
});

app.get('/api/auth/verify', (c) => {
  const authHeader = c.req.header('authorization') || c.req.header('x-auth-token') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (verifyToken(token)) {
    return c.json({ ok: true });
  }
  return c.json({ ok: false }, 401);
});

// Authentication middleware for all other /api/* routes
app.use('/api/*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/api/auth/')) {
    return next();
  }
  const authHeader = c.req.header('authorization') || c.req.header('x-auth-token') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!verifyToken(token)) {
    return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
  }
  return next();
});

app.get('/api/health', (c) => c.json({ ok: true }));
app.get('/api/clis', (c) => c.json(listClis()));
app.get('/api/projects', (c) => c.json(listProjects()));
app.get('/api/sessions', (c) => c.json(manager.list()));

app.get('/api/history', async (c) => {
  const history = await listAllConversations();
  return c.json(history);
});

app.get('/api/history/:cli/:id/detail', async (c) => {
  const cli = c.req.param('cli') as CliId;
  const id = c.req.param('id');
  const detail = await getConversationDetail(cli, id);
  if (!detail) return c.json({ error: 'not found' }, 404);
  return c.json(detail);
});

app.delete('/api/history/:cli/:id', async (c) => {
  const cli = c.req.param('cli') as CliId;
  const id = c.req.param('id');
  const ok = await deleteConversation(cli, id);
  return c.json({ ok }, ok ? 200 : 404);
});

app.post('/api/sessions', async (c) => {
  const body = (await c.req.json().catch(() => null)) as CreateSessionBody | null;
  const kind = CliId.safeParse(body?.kind);
  if (!kind.success) return c.json({ error: 'invalid kind' }, 400);

  const args = Array.isArray(body?.args)
    ? body.args.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : undefined;
  const env =
    body?.env && typeof body.env === 'object' && !Array.isArray(body.env)
      ? Object.fromEntries(
          Object.entries(body.env).filter(([k, v]) => typeof k === 'string' && typeof v === 'string'),
        )
      : undefined;

  return c.json(manager.create(kind.data, body?.cwd, args, env), 201);
});

app.post('/api/sessions/resume', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { cli?: CliId; id?: string; cwd?: string } | null;
  const cli = body?.cli;
  const convId = body?.id;
  if (!cli || !convId) return c.json({ error: 'cli and id required' }, 400);

  let args: string[] = [];
  if (cli === 'codex') {
    args = ['resume', convId];
  } else if (cli === 'pi') {
    args = ['--session', convId];
  } else if (cli === 'agy') {
    args = ['--conversation', convId];
  } else if (cli === 'claude') {
    args = ['--resume', convId];
  } else if (cli === 'opencode') {
    args = ['-s', convId];
  }

  return c.json(manager.create(cli, body.cwd, args), 201);
});

app.post('/api/sessions/:id/restart', (c) => {
  const info = manager.restart(c.req.param('id'));
  if (!info) return c.json({ error: 'no such session' }, 404);
  return c.json(info);
});

app.post('/api/translate', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { text?: string; to?: string; config?: any } | null;
  const text = body?.text;
  if (!text || typeof text !== 'string') {
    return c.json({ error: 'text is required' }, 400);
  }
  const toLang = body?.to || 'zh-CN';
  const result = await translateText(text, toLang, body?.config);
  return c.json(result, result.ok ? 200 : 502);
});

// --- Dictionary Management API ---
app.get('/api/dictionary', (c) => {
  const entries = learnedDict.getAll();
  return c.json({
    ok: true,
    totalLearned: entries.length,
    builtinCount: 2580,
    entries,
  });
});

app.post('/api/dictionary/entry', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { original?: string; translated?: string; category?: string } | null;
  if (!body?.original || !body?.translated) {
    return c.json({ error: 'original and translated required' }, 400);
  }
  learnedDict.setManual(body.original, body.translated, body.category || 'custom');
  return c.json({ ok: true });
});

app.delete('/api/dictionary/entry', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { original?: string } | null;
  if (!body?.original) return c.json({ error: 'original required' }, 400);
  const deleted = learnedDict.delete(body.original);
  return c.json({ ok: true, deleted });
});

app.post('/api/dictionary/import', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { entries?: any[] } | null;
  if (!Array.isArray(body?.entries)) return c.json({ error: 'entries array required' }, 400);
  const importedCount = learnedDict.importEntries(body.entries);
  return c.json({ ok: true, importedCount });
});

app.get('/api/dictionary/export', (c) => {
  const list = learnedDict.getAll();
  c.header('Content-Disposition', 'attachment; filename="learned_dict_backup.json"');
  return c.json(list);
});

// --- Official Dictionary & Command Studio Sync ---
app.get('/api/dictionary/sync-status', (c) => {
  return c.json({ ok: true, ...officialDictSync.getStatus() });
});

app.post('/api/dictionary/sync', async (c) => {
  const result = await officialDictSync.syncLatest();
  return c.json(result);
});

app.post('/api/commands/sources', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { name?: string; url?: string; description?: string } | null;
  if (!body?.name || !body?.url) return c.json({ error: 'name and url required' }, 400);
  const newSource = await officialDictSync.addSource(body.name, body.url, body.description);
  return c.json({ ok: true, source: newSource });
});

app.delete('/api/commands/sources/:id', async (c) => {
  const ok = await officialDictSync.removeSource(c.req.param('id'));
  return c.json({ ok }, ok ? 200 : 404);
});

app.post('/api/commands/mine', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { text?: string } | null;
  if (!body?.text) return c.json({ error: 'text required' }, 400);
  const result = await officialDictSync.mineAndIngestText(body.text);
  return c.json({ ok: true, ...result });
});

app.delete('/api/sessions/:id', (c) => {
  const ok = manager.kill(c.req.param('id'));
  return c.json({ ok }, ok ? 200 : 404);
});

// --- Static web dist ----------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../web/dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

app.get('*', (c) => {
  if (!fs.existsSync(dist)) return c.text('AgentDeck Next — web dist not built yet. Run `pnpm build`.');
  const urlPath = decodeURIComponent(new URL(c.req.url).pathname);
  let file = path.join(dist, path.normalize(urlPath).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(dist)) return c.text('forbidden', 403);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  if (!fs.existsSync(file)) return c.text('not found', 404);
  const headers: Record<string, string> = { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' };
  if (file.endsWith('.html') || file.endsWith('index.html')) {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  }
  return c.body(fs.readFileSync(file), 200, headers);
});

// --- WebSocket ----------------------------------------------------------------

interface HeartbeatWebSocket extends WebSocket {
  isAlive?: boolean;
}

const sockets = new Set<HeartbeatWebSocket>();
/** sessionId → attached sockets */
const attached = new Map<string, Set<WebSocket>>();
const unsubs = new Map<string, () => void>();
const exitUnsubs = new Map<string, () => void>();

function send(socket: WebSocket, msg: ServerMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
}

function handleClient(socket: HeartbeatWebSocket, raw: string) {
  socket.isAlive = true;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw.toString());
  } catch {
    send(socket, { type: 'error', message: 'bad json' });
    return;
  }
  const parsed = ClientMessage.safeParse(parsedJson);
  if (!parsed.success) {
    send(socket, { type: 'error', message: 'bad message' });
    return;
  }
  const msg = parsed.data;
  switch (msg.type) {
    case 'ping':
      send(socket, { type: 'pong' });
      break;
    case 'attach': {
      const session = manager.get(msg.sessionId);
      if (!session) {
        send(socket, { type: 'error', sessionId: msg.sessionId, message: 'no such session' });
        return;
      }
      let set = attached.get(msg.sessionId);
      if (!set) {
        set = new Set();
        attached.set(msg.sessionId, set);
        unsubs.set(
          msg.sessionId,
          manager.onOutput(msg.sessionId, (data) => {
            for (const s of attached.get(msg.sessionId) ?? []) {
              send(s, { type: 'output', sessionId: msg.sessionId, data });
            }
          }),
        );
        exitUnsubs.set(
          msg.sessionId,
          manager.onExit(msg.sessionId, (exitCode) => {
            for (const s of attached.get(msg.sessionId) ?? []) {
              send(s, { type: 'exit', sessionId: msg.sessionId, exitCode });
            }
            unsubs.get(msg.sessionId)?.();
            exitUnsubs.get(msg.sessionId)?.();
            unsubs.delete(msg.sessionId);
            exitUnsubs.delete(msg.sessionId);
          }),
        );
      }
      set.add(socket);
      send(socket, {
        type: 'attached',
        sessionId: msg.sessionId,
        cols: session.pty?.cols || 80,
        rows: session.pty?.rows || 24,
      });
      const snapshot = manager.snapshot(msg.sessionId);
      if (snapshot) send(socket, { type: 'output', sessionId: msg.sessionId, data: snapshot });
      break;
    }
    case 'detach':
      attached.get(msg.sessionId)?.delete(socket);
      break;
    case 'input':
      manager.write(msg.sessionId, msg.data);
      break;
    case 'resize':
      manager.resize(msg.sessionId, msg.cols, msg.rows);
      break;
  }
}

const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (socket: HeartbeatWebSocket) => {
  socket.isAlive = true;
  sockets.add(socket);
  socket.on('pong', () => {
    socket.isAlive = true;
  });
  socket.on('message', (raw) => handleClient(socket, raw as Buffer));
  socket.on('close', () => {
    sockets.delete(socket);
    for (const set of attached.values()) set.delete(socket);
  });
});

const heartbeatInterval = setInterval(() => {
  for (const socket of sockets) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 30000);

heartbeatInterval.unref();

// --- Boot ----------------------------------------------------------------------

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`[termux-webui] http://${HOST}:${info.port}`);
});

server.on('upgrade', (req, socket, head) => {
  const reqUrl = new URL(req.url ?? '/', 'http://localhost');
  if (reqUrl.pathname !== '/ws') return socket.destroy();

  // Validate token from query string ?token=... or header
  const token = reqUrl.searchParams.get('token') || (req.headers['sec-websocket-protocol'] as string) || '';
  if (!verifyToken(token)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return socket.destroy();
  }

  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
