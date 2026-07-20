import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "emberdex_session";

function getOwnerName() {
  return process.env.OWNER_NAME?.trim() || "Emberdex Keeper";
}

function getOwnerPassword() {
  const password = process.env.OWNER_PASSWORD?.trim();
  if (password) {
    return password;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("OWNER_PASSWORD must be defined in production.");
  }

  return "emberdex";
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be defined in production.");
  }

  return "emberdex-dev-session-key";
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function sessionKey() {
  return createHash("sha256")
    .update(`${getOwnerPassword()}::${getAuthSecret()}`)
    .digest();
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function verifyOwnerPassword(candidate: string) {
  return safeEqual(hash(candidate), hash(getOwnerPassword()));
}

export function issueSessionToken() {
  const ownerName = getOwnerName();
  const issuedAt = Date.now().toString(36);
  const payload = `${ownerName}.${issuedAt}`;
  const signature = createHmac("sha256", sessionKey()).update(payload).digest("base64url");

  return `${payload}.${signature}`;
}

export function verifySessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const [ownerName, issuedAt, signature] = token.split(".");

  if (!ownerName || !issuedAt || !signature) {
    return null;
  }

  const payload = `${ownerName}.${issuedAt}`;
  const expected = createHmac("sha256", sessionKey()).update(payload).digest("base64url");

  if (!safeEqual(signature, expected)) {
    return null;
  }

  return {
    ownerName,
    issuedAt,
  };
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export function getOwnerDisplayName() {
  return getOwnerName();
}

export function buildSessionCookie(value: string) {
  return {
    name: AUTH_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
