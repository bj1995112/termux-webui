import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import readline from 'node:readline';
import type { AgentConversation, CliId } from '@termux-webui/shared';

const HOME = homedir();

function cleanTitle(raw?: string): string {
  if (!raw) return '新会话';
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
  if (!text) text = '新会话';
  return text.length > 80 ? text.slice(0, 77) + '...' : text;
}

/** 1. Scan Codex Conversations */
async function scanCodexConversations(): Promise<AgentConversation[]> {
  const list: AgentConversation[] = [];
  const codexDir = path.join(HOME, '.codex');
  if (!fs.existsSync(codexDir)) return list;

  const historyFile = path.join(codexDir, 'history.jsonl');
  const sessionMap = new Map<
    string,
    { title: string; firstPrompt: string; count: number; ts: number; latestTs: number }
  >();

  if (fs.existsSync(historyFile)) {
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
          if (!sessionMap.has(sId)) {
            sessionMap.set(sId, {
              title: cleanTitle(text),
              firstPrompt: text,
              count: 1,
              ts,
              latestTs: ts,
            });
          } else {
            const cur = sessionMap.get(sId)!;
            cur.count++;
            cur.latestTs = Math.max(cur.latestTs, ts);
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Also scan sessions folder if exists
  const sessionsFolder = path.join(codexDir, 'sessions');
  if (fs.existsSync(sessionsFolder)) {
    try {
      const walk = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.name.endsWith('.jsonl')) {
            const stat = fs.statSync(full);
            // Match rollout-DATE-ID.jsonl
            const match = entry.name.match(/([0-9a-fA-F\-]{30,})/);
            const id = match ? match[1] : entry.name.replace('.jsonl', '');
            if (!sessionMap.has(id)) {
              sessionMap.set(id, {
                title: `Codex 会话 ${id.slice(0, 8)}`,
                firstPrompt: '',
                count: 1,
                ts: stat.birthtimeMs || stat.ctimeMs || Date.now(),
                latestTs: stat.mtimeMs || Date.now(),
              });
            }
          }
        }
      };
      walk(sessionsFolder);
    } catch {
      /* ignore */
    }
  }

  for (const [id, info] of sessionMap.entries()) {
    list.push({
      id,
      cli: 'codex',
      cliLabel: 'Codex',
      title: info.title,
      firstPrompt: info.firstPrompt ? cleanTitle(info.firstPrompt) : undefined,
      cwd: HOME,
      updatedAt: info.latestTs,
      createdAt: info.ts,
      messageCount: info.count,
    });
  }

  return list;
}

/** 2. Scan Pi Coding Agent Conversations */
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
          try {
            const stat = fs.statSync(full);
            const raw = fs.readFileSync(full, 'utf8');
            const lines = raw.split('\n');
            let sessionId = '';
            let cwd = HOME;
            let title = '';
            let count = 0;

            for (const line of lines) {
              if (!line.trim()) continue;
              count++;
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'session' && parsed.id) {
                  sessionId = parsed.id;
                  if (parsed.cwd) cwd = parsed.cwd;
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

            if (!sessionId) {
              const match = entry.name.match(/([0-9a-fA-F\-]{30,})/);
              sessionId = match ? match[1] : entry.name.replace('.jsonl', '');
            }

            list.push({
              id: sessionId,
              cli: 'pi',
              cliLabel: 'Pi Coding Agent',
              title: title || `Pi 会话: ${path.basename(dir).replace(/^-+|-+$/g, '') || '主目录'}`,
              cwd,
              updatedAt: stat.mtimeMs || Date.now(),
              createdAt: stat.birthtimeMs || stat.ctimeMs || Date.now(),
              messageCount: count,
            });
          } catch {
            /* ignore */
          }
        }
      }
    };
    walk(piSessionsDir);
  } catch {
    /* ignore */
  }

  return list;
}

/** 3. Scan Antigravity (Agy) Conversations */
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

      let title = '新会话';
      let firstPrompt = '';
      let msgCount = 0;
      let updatedAt = Date.now();
      let createdAt = Date.now();

      try {
        const stat = fs.statSync(convPath);
        createdAt = stat.birthtimeMs || stat.ctimeMs || Date.now();
        updatedAt = stat.mtimeMs || createdAt;
      } catch {
        /* ignore */
      }

      if (fs.existsSync(transcriptPath)) {
        try {
          const tStat = fs.statSync(transcriptPath);
          updatedAt = tStat.mtimeMs || updatedAt;

          const fileStream = fs.createReadStream(transcriptPath, { encoding: 'utf8' });
          const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

          for await (const line of rl) {
            if (!line.trim()) continue;
            msgCount++;
            if (!firstPrompt) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'USER_INPUT' && typeof parsed.content === 'string') {
                  firstPrompt = parsed.content;
                  title = cleanTitle(parsed.content);
                }
              } catch {
                /* parse error on line */
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      list.push({
        id: convId,
        cli: 'agy',
        cliLabel: 'Antigravity (Agy)',
        title,
        firstPrompt: firstPrompt ? cleanTitle(firstPrompt) : undefined,
        cwd: HOME,
        updatedAt,
        createdAt,
        messageCount: msgCount,
      });
    }
  } catch {
    /* ignore */
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
        list.push({
          id: entry.name,
          cli: 'claude',
          cliLabel: 'Claude Code',
          title: `Claude 项目: ${resolvedPath}`,
          cwd: resolvedPath,
          updatedAt: stat.mtimeMs || Date.now(),
          createdAt: stat.birthtimeMs || stat.ctimeMs || Date.now(),
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
        list.push({
          id,
          cli: 'opencode',
          cliLabel: 'OpenCode',
          title: `OpenCode 会话 ${id.slice(0, 12)}`,
          cwd: HOME,
          updatedAt: stat.mtimeMs || Date.now(),
          createdAt: stat.birthtimeMs || stat.ctimeMs || Date.now(),
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

/** Delete a specific agent conversation by CLI kind and ID */
export async function deleteConversation(cli: CliId, id: string): Promise<boolean> {
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
