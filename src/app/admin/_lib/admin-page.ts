import { redirect } from "next/navigation";
import { requireActor, type Actor } from "@/lib/session";
import { canGlobal, type GlobalPermission } from "@/modules/authorization";
import { checkPrivilegedTwoFactor } from "@/modules/admin/application/privileged-guard";

/**
 * Guard for every admin page: authentication, the page's global permission
 * (deny by default — a moderator landing on an admin-only page is sent back to
 * the dashboard) and the two-factor requirement for privileged roles.
 */
export async function requireAdminPage(permission: GlobalPermission, path: string): Promise<{ actor: Actor; twoFactorWarning: boolean }> {
  const actor = await requireActor(path);
  if (!canGlobal(actor, permission)) redirect(canGlobal(actor, "admin.dashboard") ? "/admin" : "/app");
  const check = await checkPrivilegedTwoFactor(actor);
  if (!check.ok && check.mode === "redirect") redirect(check.redirectTo);
  return { actor, twoFactorWarning: !check.ok };
}

/** FormData helpers shared by admin actions. */
export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key).trim();
  return v.length ? v : null;
}
export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}
export function int(fd: FormData, key: string, fallback: number | null = null): number | null {
  const v = str(fd, key).trim();
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) ? n : fallback;
}
export function list(fd: FormData, key: string): string[] {
  return str(fd, key)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
