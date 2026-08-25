import type { ClientMessage, ServerMessage } from '@agentdeck/shared';

type Handler = (msg: ServerMessage) => void;

/** Single WebSocket, multiplexed by sessionId. Reconnects with backoff and
 * re-attaches every active session so terminals survive network blips. */
export class DeckSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private attachedIds = new Set<string>();
  private retry = 0;
  private closedByUser = false;
  private reconnectTimer: number | null = null;

  connect() {
    this.closedByUser = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      for (const id of this.attachedIds) {
        ws.send(JSON.stringify({ type: 'attach', sessionId: id } satisfies ClientMessage));
      }
    };
    ws.onmessage = (evt) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(evt.data as string);
      } catch {
        return;
      }
      if (msg.type === 'attached') this.attachedIds.add(msg.sessionId);
      if (msg.type === 'exit') this.attachedIds.delete(msg.sessionId);
      for (const fn of this.handlers) fn(msg);
    };
    ws.onclose = () => {
      if (this.closedByUser) return;
      const delay = Math.min(8000, 600 * 2 ** this.retry++);
      this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => ws.close();
  }

  /** Idempotent attach — safe to call on every reconnect. */
  attach(sessionId: string) {
    this.attachedIds.add(sessionId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'attach', sessionId } satisfies ClientMessage));
    }
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  onMessage(fn: Handler) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  close() {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

export const deckSocket = new DeckSocket();
