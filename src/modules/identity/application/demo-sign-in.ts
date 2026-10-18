import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { DEMO_PASSWORD } from "@/db/seed/context";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isDemo } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { findDemoAccount, type DemoAccount } from "@/modules/identity/domain/demo-accounts";

/**
 * One-click sign-in for the seeded demo accounts, so testers do not type credentials.
 * Only when demo mode is on (never in production, enforced by env) and only for a known demo
 * key whose user row is flagged is_demo: a real account can never be opened this way.
 * The current session, if any, is closed first so switching roles leaves no orphan session.
 */
export async function signInAsDemoAccount(key: string, requestHeaders: Headers): Promise<DemoAccount> {
  const account = findDemoAccount(key);
  if (!isDemo || !account) throw new NotFoundError();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, account.email), eq(users.isDemo, true)))
    .limit(1);
  if (!user) throw new NotFoundError();

  const current = await auth.api.getSession({ headers: requestHeaders });
  if (current) await auth.api.signOut({ headers: requestHeaders });
  await auth.api.signInEmail({ body: { email: account.email, password: DEMO_PASSWORD, rememberMe: true }, headers: requestHeaders });
  logger.info({ demoAccount: account.key }, "demo one-click sign-in");
  return account;
}
