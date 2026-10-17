import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/auth/tokens";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "lpi_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isDemo: boolean;
};

export type CurrentAuth = {
  sessionId: string;
  user: SessionUser;
};

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { tokenHash: hashOpaqueToken(token), userId, expiresAt },
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().isProduction,
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().isProduction,
    path: "/",
    expires: new Date(0),
  });
}

/** Resolves the current session from the cookie; deduplicated per request. */
export const getCurrentAuth = cache(async (): Promise<CurrentAuth | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashOpaqueToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, email: true, name: true, role: true, isDemo: true, isActive: true } },
    },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now() || !session.user.isActive) {
    return null;
  }
  // Sliding expiration: extend when less than half of the lifetime remains.
  if (session.expiresAt.getTime() - Date.now() < SESSION_REFRESH_THRESHOLD_MS) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.session.update({ where: { id: session.id }, data: { expiresAt, lastSeenAt: new Date() } });
  }
  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      isDemo: session.user.isDemo,
    },
  };
});

export async function revokeSession(sessionId: string): Promise<void> {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Opens a session for a user and sets the cookie. */
export async function signInUser(userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(userId);
  await setSessionCookie(token, expiresAt);
}

export async function signOutCurrent(): Promise<void> {
  const auth = await getCurrentAuth();
  if (auth) await revokeSession(auth.sessionId);
  await clearSessionCookie();
}

export function homePathForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "CLIENT":
      return "/espace-client";
    case "PROVIDER":
      return "/espace-intervenant";
    case "PARTNER":
      return "/espace-partenaire";
  }
}
