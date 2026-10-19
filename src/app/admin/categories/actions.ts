"use server";
import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { createCategory, updateCategory, type CategoryInput } from "@/modules/admin/application/catalog-admin";
import { bool, int, list, optStr, str } from "@/app/admin/_lib/admin-page";

function parse(fd: FormData): CategoryInput {
  return {
    name: str(fd, "name"),
    slug: optStr(fd, "slug") ?? undefined,
    group: str(fd, "group"),
    icon: str(fd, "icon").trim(),
    description: optStr(fd, "description"),
    isChildcare: bool(fd, "isChildcare"),
    formSchemaKey: str(fd, "formSchemaKey"),
    defaultTools: list(fd, "defaultTools"),
    suggestedTemplates: list(fd, "suggestedTemplates"),
    sortOrder: int(fd, "sortOrder", 100) ?? 100,
    isActive: bool(fd, "isActive"),
  };
}

export async function createCategoryAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const row = await createCategory(actor, parse(formData));
    revalidatePath("/admin/categories");
    return { ok: true, data: { redirectTo: row ? `/admin/categories/${row.id}` : "/admin/categories" } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateCategoryAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const id = str(formData, "id");
    await updateCategory(actor, id, parse(formData));
    revalidatePath("/admin/categories");
    revalidatePath(`/admin/categories/${id}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
