"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { reactivateUser, revokeUserSessions, setGlobalRole, suspendUser } from "@/modules/admin/application/user-admin";
import { revokeSession } from "@/modules/admin/application/security-service";

export async function suspendUserAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ userId: z.string().min(1), reason: z.string().min(1).max(1000), durationDays: z.coerce.number().int().min(0).max(3650).optional() }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Paramètres invalides.");
    await suspendUser(actor, { userId: parsed.data.userId, reason: parsed.data.reason, durationDays: parsed.data.durationDays || null }, { headers: await headers() });
    revalidatePath(`/admin/utilisateurs/${parsed.data.userId}`);
    revalidatePath("/admin/utilisateurs");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function reactivateUserAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ userId: z.string().min(1), reason: z.string().min(1).max(1000) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Paramètres invalides.");
    await reactivateUser(actor, parsed.data.userId, parsed.data.reason, { headers: await headers() });
    revalidatePath(`/admin/utilisateurs/${parsed.data.userId}`);
    revalidatePath("/admin/utilisateurs");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setRoleAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ userId: z.string().min(1), role: z.enum(["user", "moderator", "admin", "super_admin"]), reason: z.string().min(1).max(1000) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Paramètres invalides.");
    await setGlobalRole(actor, parsed.data.userId, parsed.data.role, parsed.data.reason, { headers: await headers() });
    revalidatePath(`/admin/utilisateurs/${parsed.data.userId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function revokeUserSessionsAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ userId: z.string().min(1), reason: z.string().min(1).max(500) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Paramètres invalides.");
    await revokeUserSessions(actor, parsed.data.userId, parsed.data.reason, await headers());
    revalidatePath(`/admin/utilisateurs/${parsed.data.userId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function revokeSessionAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = z.object({ userId: z.string().min(1), sessionId: z.string().min(1), reason: z.string().max(500).optional().default("révocation administrateur") }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Paramètres invalides.");
    await revokeSession(actor, parsed.data.userId, parsed.data.sessionId, parsed.data.reason, await headers());
    revalidatePath("/admin/securite/sessions");
    revalidatePath(`/admin/utilisateurs/${parsed.data.userId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
