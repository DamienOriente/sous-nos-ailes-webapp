"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeNextPath } from "@/modules/identity/domain/auth";
import { signInAsDemoAccount } from "@/modules/identity/application/demo-sign-in";

const demoSignInSchema = z.object({
  account: z.string().trim().min(1).max(40),
  next: z.string().max(2048).optional(),
});

/** Demo mode only: opens the chosen seeded account without typing its credentials. */
export async function demoSignInAction(formData: FormData): Promise<void> {
  const parsed = demoSignInSchema.safeParse({ account: formData.get("account"), next: formData.get("next") ?? undefined });
  if (!parsed.success) redirect("/connexion?message=compte-demo-indisponible");
  let landing: string;
  try {
    const account = await signInAsDemoAccount(parsed.data.account, await headers());
    // An explicit destination (link to a protected page) wins over the role's home.
    landing = parsed.data.next ? safeNextPath(parsed.data.next, account.landing) : account.landing;
  } catch (err) {
    if (!isAppError(err)) logger.error({ err: (err as Error).message }, "demo sign-in failed");
    redirect("/connexion?message=compte-demo-indisponible");
  }
  redirect(landing);
}
