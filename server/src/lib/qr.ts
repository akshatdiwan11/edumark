import crypto from "node:crypto";

/**
 * Rotating QR tokens.
 *
 * A token is bound to one class session and one time window. The teacher's
 * screen shows the token for the current window; it changes every
 * `rotateSeconds`. A token is accepted for its own window plus one window of
 * grace, so a student who scans just before a rotation isn't rejected.
 * Screenshots shared after that are useless.
 */
const PREFIX = "EDM1";

export function currentWindow(rotateSeconds: number, now = Date.now()) {
  return Math.floor(now / 1000 / rotateSeconds);
}

function signature(secret: string, sessionId: string, window: number) {
  return crypto.createHmac("sha256", secret).update(`${sessionId}.${window}`).digest("base64url").slice(0, 22);
}

export function issueToken(sessionId: string, secret: string, rotateSeconds: number, now = Date.now()) {
  const window = currentWindow(rotateSeconds, now);
  const token = `${PREFIX}.${sessionId}.${window}.${signature(secret, sessionId, window)}`;
  const expiresAt = (window + 1) * rotateSeconds * 1000;
  return { token, expiresAt };
}

export function parseToken(token: string) {
  const parts = token.trim().split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  const window = Number(parts[2]);
  if (!Number.isInteger(window)) return null;
  return { sessionId: parts[1]!, window, sig: parts[3]! };
}

export type TokenCheck = "ok" | "expired" | "invalid";

export function checkToken(
  parsed: { sessionId: string; window: number; sig: string },
  secret: string,
  rotateSeconds: number,
  now = Date.now(),
): TokenCheck {
  const expected = signature(secret, parsed.sessionId, parsed.window);
  const a = Buffer.from(expected);
  const b = Buffer.from(parsed.sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return "invalid";
  const cur = currentWindow(rotateSeconds, now);
  if (parsed.window > cur) return "invalid";
  if (cur - parsed.window > 1) return "expired";
  return "ok";
}

export const newSessionSecret = () => crypto.randomBytes(32).toString("base64url");
