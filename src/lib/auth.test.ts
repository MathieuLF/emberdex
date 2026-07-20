import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_COOKIE_NAME,
  buildSessionCookie,
  getOwnerDisplayName,
  issueSessionToken,
  verifyOwnerPassword,
  verifySessionToken,
} from "./auth";

describe("auth helpers", () => {
  beforeEach(() => {
    process.env.OWNER_NAME = "Emberdex Keeper";
    process.env.OWNER_PASSWORD = "super-secret";
    process.env.AUTH_SECRET = "safest-secret";
  });

  afterEach(() => {
    delete process.env.OWNER_NAME;
    delete process.env.OWNER_PASSWORD;
    delete process.env.AUTH_SECRET;
    vi.unstubAllEnvs();
  });

  it("verifies the owner password with the configured secret", () => {
    expect(verifyOwnerPassword("super-secret")).toBe(true);
    expect(verifyOwnerPassword("wrong")).toBe(false);
  });

  it("round-trips session tokens", () => {
    const token = issueSessionToken();
    const session = verifySessionToken(token);

    expect(session?.ownerName).toBe("Emberdex Keeper");
    expect(session?.issuedAt).toBeDefined();
  });

  it("describes the owner and builds a secure cookie", () => {
    const cookie = buildSessionCookie("session-token");

    expect(getOwnerDisplayName()).toBe("Emberdex Keeper");
    expect(cookie.name).toBe(AUTH_COOKIE_NAME);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe("/");
  });

  it("requires explicit sensitive auth settings in production", () => {
    delete process.env.OWNER_PASSWORD;
    delete process.env.AUTH_SECRET;
    vi.stubEnv("NODE_ENV", "production");

    expect(() => verifyOwnerPassword("emberdex")).toThrow("OWNER_PASSWORD");
    process.env.OWNER_PASSWORD = "super-secret";
    expect(() => issueSessionToken()).toThrow("AUTH_SECRET");
  });
});
