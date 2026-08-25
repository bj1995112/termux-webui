import type { ClientMessage, ServerMessage } from '@termux-webui/shared';

type Handler = (msg: ServerMessage) => void;
type StatusListener = (status: 'connecting' | 'online' | 'offline') => void;

/** Single WebSocket, multiplexed by sessionId. Reconnects with backoff and
 * re-attaches every active session so terminals survive network blips. */
export class DeckSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private statusListeners = new Set<StatusListener>();
  private attachedIds = new Set<string>();
  private retry = 0;
  private closedByUser = false;
  private reconnectTimer: number | null = null;

  onStatus(fn: StatusListener) {
    this.statusListeners.add(fn);
    return () => {
      this.statusListeners.delete(fn);
    };
  }
  private setStatus(s: 'connecting' | 'online' | 'offline') {
    for (const fn of this.statusListeners) fn(s);
  }

  connect() {
    this.closedByUser = false;
    this.setStatus('connecting');
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setStatus('online');
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
      this.setStatus('offline');
      const delay = Math.min(8000, 600 * 2 ** this.retry++);
      this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => ws.close();
  }

  /** Idempotent attach — repeated calls for the same session on the same
   * connection are ignored, otherwise the server replays its buffer twice
   * and the terminal shows duplicated content. */
  attach(sessionId: string) {
    if (this.attachedIds.has(sessionId)) return;
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
