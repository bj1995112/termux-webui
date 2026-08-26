import type { Terminal } from '@xterm/xterm';

/** Global registry of live xterm instances keyed by sessionId */
export const terminalInstances = new Map<string, Terminal>();
export const terminalListeners = new Set<() => void>();

export function registerTerminal(sessionId: string, term: Terminal) {
  terminalInstances.set(sessionId, term);
  terminalListeners.forEach((fn) => fn());
}

export function unregisterTerminal(sessionId: string) {
  terminalInstances.delete(sessionId);
  terminalListeners.forEach((fn) => fn());
}

export function getTerminal(sessionId: string): Terminal | undefined {
  return terminalInstances.get(sessionId);
}
