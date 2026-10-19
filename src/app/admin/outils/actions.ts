"use server";
import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { createTool, updateTool, type ToolInput } from "@/modules/admin/application/catalog-admin";
import { bool, int, list, optStr, str } from "@/app/admin/_lib/admin-page";

function parse(fd: FormData): ToolInput {
  const audience = str(fd, "audience");
  return {
    key: str(fd, "key").trim(),
    name: str(fd, "name"),
    description: str(fd, "description"),
    audience: audience === "organizer" || audience === "professional" ? audience : "both",
    requiredFeature: optStr(fd, "requiredFeature"),
    categorySlugs: list(fd, "categorySlugs"),
    isActive: bool(fd, "isActive"),
    sortOrder: int(fd, "sortOrder", 100) ?? 100,
  };
}

export async function createToolAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const input = parse(formData);
    await createTool(actor, input);
    revalidatePath("/admin/outils");
    return { ok: true, data: { redirectTo: `/admin/outils/${input.key}` } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateToolAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const input = parse(formData);
    await updateTool(actor, input.key ?? "", input);
    revalidatePath("/admin/outils");
    revalidatePath(`/admin/outils/${input.key}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
