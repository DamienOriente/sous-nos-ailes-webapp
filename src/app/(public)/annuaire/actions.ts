"use server";
import { z } from "zod";
import type { ActionResult } from "@/lib/errors";
import { toActionError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { toggleFavorite } from "@/modules/directory/application/favorites-service";

export async function toggleFavoriteAction(professionalId: string): Promise<ActionResult<{ isFavorite: boolean }>> {
  try {
    const actor = await requireActorOrThrow();
    const data = await toggleFavorite(actor, z.uuid().parse(professionalId));
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}
