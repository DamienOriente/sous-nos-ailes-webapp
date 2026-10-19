import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env, isProduction } from "@/lib/env";

/**
 * Secret material. In production every key must come from the environment.
 * In local/test mode a random key is generated once into .secrets/ so the
 * developer never has to paste one (the folder is gitignored).
 */
function loadOrCreateLocalKey(name: string): string {
  const dir = path.join(process.cwd(), ".secrets");
  const file = path.join(dir, `${name}.key`);
  const read = (): string | null => {
    try {
      return readFileSync(file, "utf8").trim();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  };
  const existing = read();
  if (existing) return existing;
  if (isProduction) throw new Error(`${name} key missing in production`);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const key = randomBytes(32).toString("base64");
  try {
    // "wx": exclusive create, so two processes starting at once never overwrite each other's key.
    writeFileSync(file, key, { mode: 0o600, flag: "wx" });
    return key;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") return read() ?? key;
    throw err;
  }
}

export const authSecret: string = env.BETTER_AUTH_SECRET ?? loadOrCreateLocalKey("auth");
const dataKeyB64: string = env.DATA_ENCRYPTION_KEY ?? loadOrCreateLocalKey("data-encryption");
const dataKey = Buffer.from(dataKeyB64, "base64").subarray(0, 32);
if (dataKey.length !== 32) {
  throw new Error("DATA_ENCRYPTION_KEY must decode to at least 32 bytes");
}

const VERSION = "v1";

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptText(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unsupported encrypted payload");
  }
  const decipher = createDecipheriv("aes-256-gcm", dataKey, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}

/** Opaque, URL-safe random token (invitations, file access, unsubscribe...). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Only the hash of a token is persisted; the clear value is shown once. */
export function hashToken(token: string): string {
  return createHmac("sha256", dataKey).update(token).digest("hex");
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
