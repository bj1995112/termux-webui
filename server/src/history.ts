import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import readline from 'node:readline';
import type { AgentConversation, CliId } from '@termux-webui/shared';

const HOME = homedir();

/** Helper to clean raw XML or prompt tags */
function cleanPromptTitle(raw: string): string {
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


/** 1. Scan Antigravity (Agy) Conversations */
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
                  title = cleanPromptTitle(parsed.content);
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
        firstPrompt: firstPrompt ? cleanPromptTitle(firstPrompt) : undefined,
        cwd: HOME,
        updatedAt,
        createdAt,
        messageCount: msgCount,
      });
    }
  } catch {
    /* ignore error reading brain dir */
  }

  return list;
}

/** 2. Scan Claude Code Conversations */
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
        list.push({
          id: entry.name,
          cli: 'claude',
          cliLabel: 'Claude Code',
          title: `项目会话: ${entry.name.replace(/^-/, '/')}`,
          cwd: entry.name.startsWith('-') ? entry.name.replace(/^-/, '/') : HOME,
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

/** 3. Scan OpenCode Conversations */
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
          title: `会话 ${id.slice(0, 12)}`,
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

/** Scan all supported AI coding agents */
export async function listAllConversations(): Promise<AgentConversation[]> {
  const [agyList, claudeList, opencodeList] = await Promise.all([
    scanAgyConversations(),
    scanClaudeConversations(),
    scanOpenCodeConversations(),
  ]);

  const all = [...agyList, ...claudeList, ...opencodeList];
  all.sort((a, b) => b.updatedAt - a.updatedAt);
  return all;
}

/** Delete a specific agent conversation by CLI kind and ID */
export async function deleteConversation(cli: CliId, id: string): Promise<boolean> {
  try {
    if (cli === 'agy') {
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
