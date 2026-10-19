"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { markPaymentPaid } from "@/modules/events/application/payment-service";
import { applyBudgetTemplate, createBudgetLine, createExpense, deleteBudgetLine, deleteExpense, updateBudgetLine, updateExpense } from "@/modules/events/application/budget-service";

function revalidate(eventId: string) {
  revalidatePath(`/app/evenements/${eventId}/budget`);
  revalidatePath(`/app/evenements/${eventId}`);
}

export async function createBudgetLineAction(eventId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const res = await createBudgetLine(actor, z.uuid().parse(eventId), input);
    revalidate(eventId);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}
export async function updateBudgetLineAction(eventId: string, lineId: string, input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await updateBudgetLine(actor, z.uuid().parse(eventId), z.uuid().parse(lineId), input);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
export async function deleteBudgetLineAction(eventId: string, lineId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteBudgetLine(actor, z.uuid().parse(eventId), z.uuid().parse(lineId));
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
export async function createExpenseAction(eventId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const res = await createExpense(actor, z.uuid().parse(eventId), input);
    revalidate(eventId);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}
export async function updateExpenseAction(eventId: string, expenseId: string, input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await updateExpense(actor, z.uuid().parse(eventId), z.uuid().parse(expenseId), input);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
export async function deleteExpenseAction(eventId: string, expenseId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteExpense(actor, z.uuid().parse(eventId), z.uuid().parse(expenseId));
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function applyBudgetTemplateAction(eventId: string): Promise<ActionResult<{ created: number }>> {
  try {
    const actor = await requireActorOrThrow();
    const res = await applyBudgetTemplate(actor, z.uuid().parse(eventId));
    revalidate(eventId);
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

export async function markPaymentPaidAction(eventId: string, itemId: string, paid: boolean): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    await markPaymentPaid(actor, z.uuid().parse(eventId), z.uuid().parse(itemId), paid ? today : null);
    revalidate(eventId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
