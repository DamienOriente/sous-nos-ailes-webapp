"use server";
import { revalidatePath } from "next/cache";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { previewEditorial, saveEditorialPage, validateEditorialBody } from "@/modules/admin/application/editorial-service";
import type { BlockNode } from "@/modules/legal/domain/markdown";
import { str } from "@/app/admin/_lib/admin-page";

export async function saveEditorialAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const slug = str(formData, "slug").trim().toLowerCase();
    const isPublished = str(formData, "isPublished") === "published" ? "published" : "draft";
    await saveEditorialPage(actor, { slug, title: str(formData, "title"), body: str(formData, "body"), isPublished });
    revalidatePath("/admin/contenus");
    revalidatePath(`/${slug}`);
    revalidatePath("/classements-sponsorises");
    return { ok: true, data: { redirectTo: `/admin/contenus/${slug}` } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function previewEditorialAction(body: string): Promise<ActionResult<{ blocks: BlockNode[]; missing: string[] }>> {
  try {
    const actor = await requireActorOrThrow();
    requireGlobalPermission(actor, "admin.content.manage");
    const check = validateEditorialBody(body);
    if (!check.ok) throw new ValidationError(check.message);
    return { ok: true, data: await previewEditorial(body) };
  } catch (e) {
    return toActionError(e);
  }
}
