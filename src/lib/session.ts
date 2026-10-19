import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type AuthUser } from "@/lib/auth";
import { UnauthenticatedError } from "@/lib/errors";

export type GlobalRole = "user" | "moderator" | "admin" | "super_admin";

/** Minimal identity passed to every service call. Built once per request. */
export type Actor = {
  userId: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
  emailVerified: boolean;
  isDemo: boolean;
};

export function toActor(user: AuthUser): Actor {
  const role = (user.role ?? "user") as GlobalRole;
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    globalRole: ["user", "moderator", "admin", "super_admin"].includes(role) ? role : "user",
    emailVerified: user.emailVerified,
    isDemo: Boolean((user as { isDemo?: boolean }).isDemo),
  };
}

/** Cached per request (React cache) so layouts and pages share one lookup. */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session;
});

export async function getActor(): Promise<Actor | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.user.banned) return null;
  return toActor(session.user);
}

/** For pages: redirects to the sign-in page, keeping the destination. */
export async function requireActor(nextPath?: string): Promise<Actor> {
  const actor = await getActor();
  if (!actor) {
    const target = nextPath ? `/connexion?next=${encodeURIComponent(nextPath)}` : "/connexion";
    redirect(target);
  }
  return actor;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireActorOrThrow(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new UnauthenticatedError();
  return actor;
}
