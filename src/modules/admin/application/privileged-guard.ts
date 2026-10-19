import { isProduction } from "@/lib/env";
import type { Actor } from "@/lib/session";
import { hasTwoFactorEnabled } from "@/modules/admin/application/user-admin";

/**
 * Two-factor requirement for privileged roles (moderator, admin, super_admin).
 * Production: the page must redirect to the security settings. Local/demo: a
 * persistent warning banner, otherwise the demo accounts could not be used.
 */
export type PrivilegedCheck = { ok: true } | { ok: false; mode: "redirect"; redirectTo: string } | { ok: false; mode: "warn" };

export const TWO_FACTOR_SETUP_PATH = "/app/compte/securite?required=2fa";

export async function checkPrivilegedTwoFactor(actor: Actor): Promise<PrivilegedCheck> {
  if (actor.globalRole === "user") return { ok: true };
  if (await hasTwoFactorEnabled(actor.userId)) return { ok: true };
  return isProduction ? { ok: false, mode: "redirect", redirectTo: TWO_FACTOR_SETUP_PATH } : { ok: false, mode: "warn" };
}
