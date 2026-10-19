"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/errors";
import { toActionError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import type { FormState } from "@/components/professionals/action-form";
import { eurosToCents, formToObject, toActionErrorWithFields, validationResult } from "@/modules/professionals/application/form-parsing";
import { createService, deleteService, moveService, updateService } from "@/modules/professionals/application/services-service";
import { serviceSchema } from "@/modules/professionals/domain/listing-schema";

const idSchema = z.uuid();

function parse(form: FormData) {
  const raw = formToObject(form);
  raw.priceCents = eurosToCents(raw.priceEuros);
  raw.isActive = raw.isActive === undefined ? true : raw.isActive === "on";
  return serviceSchema.safeParse(raw);
}

export async function saveServiceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActorOrThrow();
  const professionalId = idSchema.parse(form.get("professionalId"));
  const serviceId = form.get("serviceId");
  const parsed = parse(form);
  if (!parsed.success) return validationResult(parsed.error);
  try {
    if (typeof serviceId === "string" && serviceId) await updateService(actor, professionalId, idSchema.parse(serviceId), parsed.data);
    else await createService(actor, professionalId, parsed.data);
    revalidatePath(`/app/pro/${professionalId}/prestations`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionErrorWithFields(e);
  }
}

export async function deleteServiceAction(professionalId: string, serviceId: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await deleteService(actor, idSchema.parse(professionalId), idSchema.parse(serviceId));
    revalidatePath(`/app/pro/${professionalId}/prestations`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function moveServiceAction(professionalId: string, serviceId: string, direction: "up" | "down"): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await moveService(actor, idSchema.parse(professionalId), idSchema.parse(serviceId), direction);
    revalidatePath(`/app/pro/${professionalId}/prestations`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
