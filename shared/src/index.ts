import { z } from 'zod';

/** Known CLI kinds. `shell` is always available (user's own shell). */
export const CliId = z.enum(['shell', 'agy', 'pi', 'claude', 'opencode', 'codex', 'openclaw', 'hermes']);
export type CliId = z.infer<typeof CliId>;

export interface CliInfo {
  id: CliId;
  label: string;
  available: boolean;
  /** Resolved binary path, when found on PATH. */
  path?: string;
}

export interface SessionInfo {
  id: string;
  kind: CliId;
  cwd: string;
  createdAt: number;
  status?: 'running' | 'exited';
  exitCode?: number;
  args?: string[];
}

// ---- WebSocket: client → server -------------------------------------------

export const ClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('attach'), sessionId: z.string() }),
  z.object({ type: z.literal('detach'), sessionId: z.string() }),
  z.object({ type: z.literal('input'), sessionId: z.string(), data: z.string() }),
  z.object({
    type: z.literal('resize'),
    sessionId: z.string(),
    cols: z.number().int().min(2).max(500),
    rows: z.number().int().min(2).max(300),
  }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ---- WebSocket: server → client -------------------------------------------

export type ServerMessage =
  | { type: 'pong' }
  | { type: 'attached'; sessionId: string; cols: number; rows: number }
  | { type: 'output'; sessionId: string; data: string }
  | { type: 'exit'; sessionId: string; exitCode: number }
  | { type: 'error'; sessionId?: string; message: string };

export interface CreateSessionBody {
  kind: CliId;
  cwd?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface ProjectInfo {
  name: string;
  path: string;
}

export interface AgentConversation {
  id: string;
  cli: CliId;
  cliLabel: string;
  title: string;
  firstPrompt?: string;
  cwd: string;
  updatedAt: number;
  createdAt: number;
  messageCount?: number;
  tokenUsage?: number;
}


