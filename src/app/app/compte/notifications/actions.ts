"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { updateNotificationPreferences } from "@/modules/identity/application/profile-service";
import { notificationPreferencesSchema } from "@/modules/identity/domain/notification-preferences";

export async function updateNotificationPreferencesAction(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = notificationPreferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Préférences invalides.", code: "validation" };
  try {
    const actor = await requireActorOrThrow();
    const h = await headers();
    await updateNotificationPreferences(actor, parsed.data, { ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null, userAgent: h.get("user-agent") });
    revalidatePath("/app/compte/notifications");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
