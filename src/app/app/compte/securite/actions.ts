"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { NotFoundError, toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { isTwoFactorEnabled, recordSecurityEvent } from "@/modules/identity/application/security-service";
import { findMySessionToken } from "@/modules/identity/application/session-service";
import { authErrorMessage, changePasswordSchema } from "@/modules/identity/domain/auth";

async function requestContext() {
  const h = await headers();
  return { headers: h, ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null, userAgent: h.get("user-agent") };
}

function mapAuthError(e: unknown): ActionResult<never> {
  if (e instanceof APIError) {
    const code = typeof e.body?.code === "string" ? e.body.code : undefined;
    return { ok: false, error: authErrorMessage(code, e.statusCode), code: e.statusCode === 429 ? "rate_limited" : "validation" };
  }
  return toActionError(e);
}

/** Password change through better-auth's endpoint; other sessions revoked by default, event journalised. */
export async function changePasswordAction(input: unknown): Promise<ActionResult<{ revokedOthers: boolean }>> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    return { ok: false, error: "Vérifiez les champs du formulaire.", code: "validation", fieldErrors: Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v ?? []])) };
  }
  try {
    const actor = await requireActorOrThrow();
    const ctx = await requestContext();
    await auth.api.changePassword({
      body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: parsed.data.revokeOtherSessions },
      headers: ctx.headers,
    });
    await recordSecurityEvent({ type: "password_changed", userId: actor.userId, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent, details: { revokedOtherSessions: parsed.data.revokeOtherSessions } });
    revalidatePath("/app/compte/securite");
    return { ok: true, data: { revokedOthers: parsed.data.revokeOtherSessions } };
  } catch (e) {
    return mapAuthError(e);
  }
}

/** Revokes one of the caller's own sessions, looked up by id (tokens never reach the browser). */
export async function revokeSessionAction(sessionId: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const id = z.string().min(1).max(128).safeParse(sessionId);
    if (!id.success) throw new ValidationError();
    const ctx = await requestContext();
    const token = await findMySessionToken(ctx.headers, id.data);
    if (!token) throw new NotFoundError("Session introuvable.");
    await auth.api.revokeSession({ body: { token }, headers: ctx.headers });
    await recordSecurityEvent({ type: "session_revoked", userId: actor.userId, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent, details: { sessionId: id.data } });
    revalidatePath("/app/compte/securite");
    return { ok: true, data: undefined };
  } catch (e) {
    return mapAuthError(e);
  }
}

export async function revokeOtherSessionsAction(): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const ctx = await requestContext();
    await auth.api.revokeOtherSessions({ headers: ctx.headers });
    await recordSecurityEvent({ type: "sessions_revoked_all", userId: actor.userId, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
    revalidatePath("/app/compte/securite");
    return { ok: true, data: undefined };
  } catch (e) {
    return mapAuthError(e);
  }
}

const twoFactorChangeSchema = z.enum(["enabled", "disabled", "backup_codes"]);

/**
 * Called by the client after a better-auth two-factor call succeeded. The
 * journal entry reflects the state actually stored in `users.two_factor_enabled`,
 * not what the browser claims.
 */
export async function recordTwoFactorChangeAction(kind: unknown): Promise<ActionResult<{ enabled: boolean }>> {
  const parsed = twoFactorChangeSchema.safeParse(kind);
  if (!parsed.success) return { ok: false, error: "Opération inconnue.", code: "validation" };
  try {
    const actor = await requireActorOrThrow();
    const enabled = await isTwoFactorEnabled(actor.userId);
    const ctx = await requestContext();
    if (parsed.data === "enabled" && enabled) await recordSecurityEvent({ type: "two_factor_enabled", userId: actor.userId, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent, details: { method: "totp" } });
    if (parsed.data === "disabled" && !enabled) await recordSecurityEvent({ type: "two_factor_disabled", userId: actor.userId, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
    if (parsed.data === "backup_codes" && enabled) await recordSecurityEvent({ type: "backup_codes_regenerated", userId: actor.userId, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
    revalidatePath("/app", "layout");
    return { ok: true, data: { enabled } };
  } catch (e) {
    return toActionError(e);
  }
}
