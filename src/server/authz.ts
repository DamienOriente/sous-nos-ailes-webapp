import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { getCurrentAuth, homePathForRole, type SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/server/errors";

/** Returns the signed-in user or redirects to the login page. */
export async function requireUser(options: { roles?: Role[]; next?: string } = {}): Promise<SessionUser> {
  const auth = await getCurrentAuth();
  if (!auth) {
    const target = options.next ? `/connexion?next=${encodeURIComponent(options.next)}` : "/connexion";
    redirect(target);
  }
  if (options.roles && !options.roles.includes(auth.user.role)) {
    redirect(homePathForRole(auth.user.role));
  }
  return auth.user;
}

export async function requireAdmin(next?: string): Promise<SessionUser> {
  return requireUser({ roles: ["ADMIN"], next });
}

export async function requireProvider(next?: string) {
  const user = await requireUser({ roles: ["PROVIDER"], next });
  const profile = await db.providerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/connexion");
  return { user, profile };
}

export async function requirePartner(next?: string) {
  const user = await requireUser({ roles: ["PARTNER"], next });
  const venue = await db.partnerVenue.findUnique({ where: { partnerUserId: user.id } });
  if (!venue) redirect("/connexion");
  return { user, venue };
}

export async function getOptionalUser(): Promise<SessionUser | null> {
  const auth = await getCurrentAuth();
  return auth?.user ?? null;
}

/** For Server Actions: throws instead of redirecting. */
export async function requireActionUser(roles?: Role[]): Promise<SessionUser> {
  const auth = await getCurrentAuth();
  if (!auth) throw new AuthorizationError("Votre session a expiré. Reconnectez-vous.");
  if (roles && !roles.includes(auth.user.role)) throw new AuthorizationError();
  return auth.user;
}

export function assertAuthorized(condition: unknown, message?: string): asserts condition {
  if (!condition) throw new AuthorizationError(message);
}
