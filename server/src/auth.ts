import { randomBytes, createHmac } from 'node:crypto';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '000000';
// Secret key generated per server lifecycle (or from env)
const SERVER_SECRET = process.env.SERVER_SECRET || randomBytes(32).toString('hex');

// Set of valid issued tokens
const validTokens = new Set<string>();

/** Generate a signed secure token */
export function createToken(): string {
  const payload = `${Date.now()}-${randomBytes(16).toString('hex')}`;
  const sig = createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  const token = `${payload}.${sig}`;
  validTokens.add(token);
  return token;
}

/** Verify if a token is valid */
export function verifyToken(token?: string | null): boolean {
  if (!token) return false;
  if (!validTokens.has(token)) {
    // Also check HMAC signature validity
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, sig] = parts;
    const expectedSig = createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
    if (sig === expectedSig) {
      validTokens.add(token);
      return true;
    }
    return false;
  }
  return true;
}

/** Check user password */
export function checkPassword(password: string): boolean {
  return password === AUTH_PASSWORD;
}

/** Invalidate token on logout */
export function revokeToken(token: string) {
  validTokens.delete(token);
}
