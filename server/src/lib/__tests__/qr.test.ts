import { describe, expect, it } from "vitest";
import { checkToken, issueToken, newSessionSecret, parseToken } from "../qr.js";

describe("rotating QR tokens", () => {
  const secret = newSessionSecret();
  const t0 = 1_700_000_000_000;

  it("accepts a fresh token", () => {
    const { token } = issueToken("sess1", secret, 20, t0);
    expect(checkToken(parseToken(token)!, secret, 20, t0 + 1000)).toBe("ok");
  });

  it("accepts the previous window as grace, then expires", () => {
    const { token } = issueToken("sess1", secret, 20, t0);
    expect(checkToken(parseToken(token)!, secret, 20, t0 + 25_000)).toBe("ok");
    expect(checkToken(parseToken(token)!, secret, 20, t0 + 61_000)).toBe("expired");
  });

  it("rejects tampered or foreign tokens", () => {
    const { token } = issueToken("sess1", secret, 20, t0);
    const parsed = parseToken(token)!;
    expect(checkToken({ ...parsed, sessionId: "sess2" }, secret, 20, t0)).toBe("invalid");
    expect(checkToken(parsed, newSessionSecret(), 20, t0)).toBe("invalid");
    expect(checkToken({ ...parsed, window: parsed.window + 5 }, secret, 20, t0)).toBe("invalid");
    expect(parseToken("hello")).toBeNull();
  });
});
