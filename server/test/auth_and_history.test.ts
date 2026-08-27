import { describe, it, expect } from 'vitest';
import { checkPassword, createToken, verifyToken } from '../src/auth.js';
import { listAllConversations } from '../src/history.js';

describe('Auth & History Cache', () => {
  it('verifies default password 000000', () => {
    expect(checkPassword('000000')).toBe(true);
    expect(checkPassword('wrong-pwd')).toBe(false);
  });

  it('issues and verifies HMAC tokens', () => {
    const token = createToken();
    expect(verifyToken(token)).toBe(true);
    expect(verifyToken('bad.token.signature')).toBe(false);
  });

  it('scans history without error and uses cache', async () => {
    const start1 = performance.now();
    const list1 = await listAllConversations();
    const dur1 = performance.now() - start1;

    const start2 = performance.now();
    const list2 = await listAllConversations();
    const dur2 = performance.now() - start2;

    expect(Array.isArray(list1)).toBe(true);
    expect(list1.length).toBe(list2.length);
    // Cached second read should be lightning fast
    expect(dur2).toBeLessThanOrEqual(dur1 + 50);
  });
});
