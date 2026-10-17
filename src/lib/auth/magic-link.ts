import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/auth/tokens";

const MAGIC_LINK_TTL_MS = 20 * 60 * 1000;

/** Creates a single-use login link (random token, stored hashed, 20 minutes). */
export async function createMagicLink(userId: string): Promise<{ url: string; expiresAt: Date }> {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);
  await db.loginToken.create({
    data: { tokenHash: hashOpaqueToken(token), userId, expiresAt, purpose: "MAGIC_LINK" },
  });
  const url = `${getEnv().APP_URL}/connexion/lien/${token}`;
  return { url, expiresAt };
}

/** Consumes a login link atomically. Returns the user id or null when invalid. */
export async function consumeMagicLink(token: string): Promise<string | null> {
  if (!token || token.length > 128) return null;
  const tokenHash = hashOpaqueToken(token);
  const record = await db.loginToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) return null;
  // updateMany with the usedAt guard makes the consumption atomic.
  const result = await db.loginToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (result.count !== 1) return null;
  return record.userId;
}
