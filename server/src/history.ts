import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import readline from 'node:readline';
import type { AgentConversation, CliId, ConversationDetail, ConversationMessage } from '@termux-webui/shared';

const HOME = homedir();

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatFallbackTitle(ts: number, projectName?: string): string {
  if (!ts) return '新对话';
  const d = new Date(ts);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const tag = projectName && projectName !== 'root' && projectName !== '~' ? ` · ${projectName}` : '';
  return `${month}月${date}日 ${hours}:${mins} 对话${tag}`;
}

export function cleanTitle(raw?: string): string {
  if (!raw) return '';
  const userMatch = raw.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  let text = userMatch ? userMatch[1] : raw;
  text = text
    .replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{[\s\S]*?\}\}/g, '')
    .replace(/The current local time is:[\s\S]*$/gi, '')
    .replace(/The user changed setting[\s\S]*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 80 ? text.slice(0, 77) + '...' : text;
}

// ---- Mtime Caching Layer for ultra-fast history scanning ------------------

interface CacheEntry<T> {
  mtime: number;
  data: T;
}

const fileCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(filePath: string, parseFn: () => T): T {
  try {
    const stat = fs.statSync(filePath);
    const curMtime = stat.mtimeMs;
    const cached = fileCache.get(filePath);
    if (cached && cached.mtime === curMtime) {
      return cached.data as T;
    }
    const data = parseFn();
    fileCache.set(filePath, { mtime: curMtime, data });
    return data;
  } catch {
    return parseFn();
  }
}

/** 1. Scan Codex Conversations with exact timestamps & mtime caching */
async function scanCodexConversations(): Promise<AgentConversation[]> {
  const list: AgentConversation[] = [];
  const codexDir = path.join(HOME, '.codex');
  if (!fs.existsSync(codexDir)) return list;

  const historyFile = path.join(codexDir, 'history.jsonl');
  if (!fs.existsSync(historyFile)) return list;

  return getCached(historyFile, () => {
    const sessionMap = new Map<
      string,
      { title: string; firstPrompt: string; count: number; createdAt: number; updatedAt: number }
    >();

    try {
      const content = fs.readFileSync(historyFile, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line);
          const sId = item.session_id || 'default';
          const text = item.text || '';
          const ts = item.ts ? Number(item.ts) * 1000 : Date.now();
          const parsedTitle = cleanTitle(text) || formatFallbackTitle(ts);
          if (!sessionMap.has(sId)) {
            sessionMap.set(sId, {
              title: parsedTitle,
              firstPrompt: text,
              count: 1,
              createdAt: ts,
              updatedAt: ts,
            });
          } else {
            const cur = sessionMap.get(sId)!;
            cur.count++;
            cur.updatedAt = Math.max(cur.updatedAt, ts);
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }

    const res: AgentConversation[] = [];
    for (const [id, info] of sessionMap.entries()) {
      if (!info.firstPrompt) continue;
      res.push({
        id,
        cli: 'codex',
        cliLabel: 'Codex',
        title: info.title,
        firstPrompt: cleanTitle(info.firstPrompt) || undefined,
        cwd: HOME,
        updatedAt: info.updatedAt,
        createdAt: info.createdAt,
        messageCount: info.count,
      });
    }
    return res;
  });
}

/** 2. Scan Pi Coding Agent Conversations with exact message timestamps */
async function scanPiConversations(): Promise<AgentConversation[]> {
  const list: AgentConversation[] = [];
  const piSessionsDir = path.join(HOME, '.pi/agent/sessions');
  if (!fs.existsSync(piSessionsDir)) return list;

  try {
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.jsonl')) {
          const conv = getCached(full, () => {
            try {
              const raw = fs.readFileSync(full, 'utf8');
              const lines = raw.split('\n');
              let sessionId = '';
              let cwd = HOME;
              let title = '';
              let count = 0;
              let createdAt = 0;
              let updatedAt = 0;

              for (const line of lines) {
                if (!line.trim()) continue;
                count++;
                try {
                  const parsed = JSON.parse(line);
                  let lineTs = 0;
                  if (parsed.timestamp) {
                    lineTs = typeof parsed.timestamp === 'number' ? parsed.timestamp : new Date(parsed.timestamp).getTime();
                  }

                  if (parsed.type === 'session' && parsed.id) {
                    sessionId = parsed.id;
                    if (parsed.cwd) cwd = parsed.cwd;
                    if (lineTs && !createdAt) createdAt = lineTs;
                  }

                  if (lineTs) {
                    if (!createdAt) createdAt = lineTs;
                    updatedAt = Math.max(updatedAt, lineTs);
                  }

                  if (!title && parsed.type === 'message' && parsed.message?.role === 'user') {
                    const content = parsed.message.content;
                    if (Array.isArray(content)) {
                      for (const c of content) {
                        if (c.type === 'text' && c.text) {
                          title = cleanTitle(c.text);
                          break;
                        }
                      }
                    } else if (typeof content === 'string') {
                      title = cleanTitle(content);
                    }
                  }
                } catch {
                  /* parse error */
                }
              }

              if (!createdAt) {
                try {
                  createdAt = fs.statSync(full).birthtimeMs || fs.statSync(full).mtimeMs;
                } catch {
                  createdAt = Date.now();
                }
              }
              if (!updatedAt) updatedAt = createdAt;

              if (!sessionId) {
                const match = entry.name.match(/([0-9a-fA-F\-]{30,})/);
                sessionId = match ? match[1] : entry.name.replace('.jsonl', '');
              }

              if (!title) return null;
              const projName = path.basename(dir).replace(/^-+|-+$/g, '') || '';
              return {
                id: sessionId,
                cli: 'pi' as CliId,
                cliLabel: 'Pi Coding Agent',
                title: title || formatFallbackTitle(createdAt, projName),
                cwd,
                updatedAt,
                createdAt,
                messageCount: count,
              };
            } catch {
              return null;
            }
          });
          if (conv) list.push(conv);
        }
      }
    };
    walk(piSessionsDir);
  } catch {
    /* ignore */
  }

  return list;
}

/** 3. Scan Antigravity (Agy) Conversations with exact step timestamps */
async function scanAgyConversations(): Promise<AgentConversation[]> {
  const list: AgentConversation[] = [];
  const brainDir = path.join(HOME, '.gemini/antigravity-cli/brain');
  if (!fs.existsSync(brainDir)) return list;

  try {
    const entries = fs.readdirSync(brainDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const convId = entry.name;
      const convPath = path.join(brainDir, convId);
      const transcriptPath = path.join(convPath, '.system_generated/logs/transcript.jsonl');

      if (!fs.existsSync(transcriptPath)) continue;

      const conv = getCached(transcriptPath, () => {
        let title = '';
        let firstPrompt = '';
        let msgCount = 0;
        let createdAt = 0;
        let updatedAt = 0;

        try {
          const raw = fs.readFileSync(transcriptPath, 'utf8');
          const lines = raw.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            msgCount++;
            try {
              const parsed = JSON.parse(line);
              let lineTs = 0;
              if (parsed.created_at) {
                lineTs = new Date(parsed.created_at).getTime();
              }
              if (lineTs) {
                if (!createdAt) createdAt = lineTs;
                updatedAt = Math.max(updatedAt, lineTs);
              }
              if (!firstPrompt && parsed.type === 'USER_INPUT' && typeof parsed.content === 'string') {
                firstPrompt = parsed.content;
                title = cleanTitle(parsed.content);
              }
            } catch {
              /* ignore line parse */
            }
          }
        } catch {
          /* ignore */
        }

        if (!firstPrompt) return null;

        if (!createdAt) {
          try {
            const stat = fs.statSync(convPath);
            createdAt = stat.birthtimeMs || stat.ctimeMs || Date.now();
          } catch {
            createdAt = Date.now();
          }
        }
        if (!updatedAt) updatedAt = createdAt;

        return {
          id: convId,
          cli: 'agy' as CliId,
          cliLabel: 'Antigravity (Agy)',
          title: title || formatFallbackTitle(createdAt),
          firstPrompt: firstPrompt ? cleanTitle(firstPrompt) : undefined,
          cwd: HOME,
          updatedAt,
          createdAt,
          messageCount: msgCount,
        };
      });

      if (conv) list.push(conv);
    }
  } catch {
    /* ignore error reading brain dir */
  }

  return list;
}

/** 4. Scan Claude Code Conversations */
async function scanClaudeConversations(): Promise<AgentConversation[]> {
  const list: AgentConversation[] = [];
  const claudeProjects = path.join(HOME, '.claude/projects');
  if (!fs.existsSync(claudeProjects)) return list;

  try {
    const entries = fs.readdirSync(claudeProjects, { withFileTypes: true });
    for (const entry of entries) {
      const projPath = path.join(claudeProjects, entry.name);
      try {
        const stat = fs.statSync(projPath);
        const resolvedPath = entry.name.startsWith('-') ? entry.name.replace(/^-/, '/') : HOME;
        const created = stat.birthtimeMs || stat.ctimeMs || Date.now();
        list.push({
          id: entry.name,
          cli: 'claude',
          cliLabel: 'Claude Code',
          title: `Claude 项目: ${resolvedPath}`,
          cwd: resolvedPath,
          updatedAt: stat.mtimeMs || Date.now(),
          createdAt: created,
          messageCount: 1,
        });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  return list;
}

/** 5. Scan OpenCode Conversations */
async function scanOpenCodeConversations(): Promise<AgentConversation[]> {
  const list: AgentConversation[] = [];
  const diffDir = path.join(HOME, '.local/share/opencode/storage/session_diff');
  if (!fs.existsSync(diffDir)) return list;

  try {
    const files = fs.readdirSync(diffDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(diffDir, file);
      const id = file.replace(/\.json$/, '');
      try {
        const stat = fs.statSync(filePath);
        const created = stat.birthtimeMs || stat.ctimeMs || Date.now();
        list.push({
          id,
          cli: 'opencode',
          cliLabel: 'OpenCode',
          title: formatFallbackTitle(created),
          cwd: HOME,
          updatedAt: stat.mtimeMs || Date.now(),
          createdAt: created,
          messageCount: 1,
        });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  return list;
}

/** Scan all supported AI coding agents globally and locally */
export async function listAllConversations(): Promise<AgentConversation[]> {
  const [codexList, piList, agyList, claudeList, opencodeList] = await Promise.all([
    scanCodexConversations(),
    scanPiConversations(),
    scanAgyConversations(),
    scanClaudeConversations(),
    scanOpenCodeConversations(),
  ]);

  const all = [...codexList, ...piList, ...agyList, ...claudeList, ...opencodeList];
  all.sort((a, b) => b.updatedAt - a.updatedAt);
  return all;
}

/** Retrieve full messages for a conversation for read-only preview */
export async function getConversationDetail(cli: CliId, id: string): Promise<ConversationDetail | null> {
  const all = await listAllConversations();
  const meta = all.find((c) => c.cli === cli && c.id === id);
  if (!meta) return null;

  const messages: ConversationMessage[] = [];

  try {
    if (cli === 'codex') {
      const historyFile = path.join(HOME, '.codex/history.jsonl');
      if (fs.existsSync(historyFile)) {
        const raw = fs.readFileSync(historyFile, 'utf8');
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue;
          try {
            const item = JSON.parse(line);
            if (item.session_id === id) {
              messages.push({
                role: 'user',
                content: cleanTitle(item.text) || item.text || '',
                timestamp: item.ts ? Number(item.ts) * 1000 : undefined,
              });
            }
          } catch {
            /* ignore */
          }
        }
      }
    } else if (cli === 'pi') {
      const piSessionsDir = path.join(HOME, '.pi/agent/sessions');
      let targetFile = '';
      const findFile = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) findFile(full);
          else if (entry.name.includes(id) && entry.name.endsWith('.jsonl')) {
            targetFile = full;
            return;
          }
        }
      };
      if (fs.existsSync(piSessionsDir)) findFile(piSessionsDir);

      if (targetFile && fs.existsSync(targetFile)) {
        const raw = fs.readFileSync(targetFile, 'utf8');
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'message' && parsed.message) {
              const role = parsed.message.role === 'assistant' ? 'assistant' : 'user';
              let text = '';
              const content = parsed.message.content;
              if (Array.isArray(content)) {
                text = content
                  .filter((c: { type?: string; text?: string }) => c.type === 'text' && c.text)
                  .map((c: { text: string }) => c.text)
                  .join('\n');
              } else if (typeof content === 'string') {
                text = content;
              }
              if (text) {
                messages.push({
                  role,
                  content: text,
                  timestamp: parsed.timestamp ? new Date(parsed.timestamp).getTime() : undefined,
                });
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
    } else if (cli === 'agy') {
      const transcriptPath = path.join(HOME, '.gemini/antigravity-cli/brain', id, '.system_generated/logs/transcript.jsonl');
      if (fs.existsSync(transcriptPath)) {
        const raw = fs.readFileSync(transcriptPath, 'utf8');
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const ts = parsed.created_at ? new Date(parsed.created_at).getTime() : undefined;
            if (parsed.type === 'USER_INPUT' && typeof parsed.content === 'string') {
              messages.push({
                role: 'user',
                content: cleanTitle(parsed.content) || parsed.content,
                timestamp: ts,
              });
            } else if (parsed.type === 'PLANNER_RESPONSE') {
              const text = parsed.content || (parsed.thinking ? `*思考过程:*\n${parsed.thinking}` : '');
              if (text) {
                messages.push({
                  role: 'assistant',
                  content: text,
                  timestamp: ts,
                });
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* ignore read error */
  }

  // Fallback to firstPrompt if no messages extracted
  if (messages.length === 0 && meta.firstPrompt) {
    messages.push({
      role: 'user',
      content: meta.firstPrompt,
      timestamp: meta.createdAt,
    });
  }

  return { conversation: meta, messages };
}

/** Delete a specific agent conversation by CLI kind and ID */
export async function deleteConversation(cli: CliId, id: string): Promise<boolean> {
  fileCache.clear();
  try {
    if (cli === 'codex') {
      const historyFile = path.join(HOME, '.codex/history.jsonl');
      if (fs.existsSync(historyFile)) {
        const raw = fs.readFileSync(historyFile, 'utf8');
        const remaining = raw
          .split('\n')
          .filter((line) => {
            if (!line.trim()) return false;
            try {
              const item = JSON.parse(line);
              return item.session_id !== id;
            } catch {
              return true;
            }
          })
          .join('\n');
        fs.writeFileSync(historyFile, remaining, 'utf8');
      }
      return true;
    } else if (cli === 'pi') {
      const sessionsDir = path.join(HOME, '.pi/agent/sessions');
      if (fs.existsSync(sessionsDir)) {
        const walkAndDelete = (dir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walkAndDelete(full);
            } else if (entry.name.includes(id)) {
              fs.rmSync(full, { force: true });
            }
          }
        };
        walkAndDelete(sessionsDir);
      }
      return true;
    } else if (cli === 'agy') {
      const convPath = path.join(HOME, '.gemini/antigravity-cli/brain', id);
      if (fs.existsSync(convPath)) {
        fs.rmSync(convPath, { recursive: true, force: true });
        return true;
      }
    } else if (cli === 'claude') {
      const projPath = path.join(HOME, '.claude/projects', id);
      if (fs.existsSync(projPath)) {
        fs.rmSync(projPath, { recursive: true, force: true });
        return true;
      }
    } else if (cli === 'opencode') {
      const diffPath = path.join(HOME, '.local/share/opencode/storage/session_diff', `${id}.json`);
      if (fs.existsSync(diffPath)) {
        fs.rmSync(diffPath, { force: true });
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
