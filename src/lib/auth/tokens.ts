import { createHmac, randomBytes } from "node:crypto";
import { getSessionSecret } from "@/lib/env";

/** 256-bit random, URL-safe token. Only its keyed hash is ever stored. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Keyed hash (HMAC-SHA256 with the session secret) of an opaque token. */
export function hashOpaqueToken(token: string): string {
  return createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}
