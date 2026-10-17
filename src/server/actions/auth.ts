"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { homePathForRole, signInUser, signOutCurrent } from "@/lib/auth/session";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { peekRateLimit, rateLimit } from "@/lib/rate-limit";
import { getClientKey } from "@/lib/request-meta";
import { authenticateWithPassword, sendMagicLinkIfUserExists } from "@/server/services/users";
import { magicLinkRequestSchema, passwordLoginSchema } from "@/validation/auth";
import { fieldErrorsOf, formDataToObject } from "@/validation/common";
import { errorState, successState, type ActionState } from "@/server/action-state";

/** Only same-origin relative paths are accepted as post-login targets. */
function safeNextPath(value: string | undefined | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

export async function loginWithPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = passwordLoginSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Vérifiez les champs du formulaire.", fieldErrorsOf(parsed.error));
  const clientKey = await getClientKey();
  // Only failed attempts count: 5 failures per address and client within 15 minutes.
  const limitOptions = { key: `login:${clientKey}:${parsed.data.email}`, limit: 5, windowMs: 15 * 60_000 };
  const limit = peekRateLimit(limitOptions);
  if (!limit.ok) return errorState(`Trop de tentatives. Réessayez dans ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);
  const user = await authenticateWithPassword(parsed.data.email, parsed.data.password);
  if (!user) {
    rateLimit(limitOptions);
    return errorState("Adresse ou mot de passe incorrect.");
  }
  await signInUser(user.id);
  redirect(safeNextPath(parsed.data.next) ?? homePathForRole(user.role));
}

export async function requestLoginLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = magicLinkRequestSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Vérifiez l’adresse email.", fieldErrorsOf(parsed.error));
  const clientKey = await getClientKey();
  const limit = rateLimit({ key: `magic:${clientKey}`, limit: 5, windowMs: 15 * 60_000 });
  const perEmail = rateLimit({ key: `magic-email:${parsed.data.email}`, limit: 3, windowMs: 15 * 60_000 });
  if (!limit.ok || !perEmail.ok) return errorState("Trop de demandes. Réessayez dans quelques minutes.");
  await sendMagicLinkIfUserExists(parsed.data.email);
  return successState("Si un espace existe pour cette adresse, un lien de connexion vient d’être envoyé. Il est valable 20 minutes.");
}

const consumeSchema = z.object({ token: z.string().min(16).max(128), next: z.string().max(300).optional() });

export async function consumeLoginLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = consumeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Lien invalide.");
  const userId = await consumeMagicLink(parsed.data.token);
  if (!userId) return errorState("Ce lien est invalide, déjà utilisé ou expiré. Demandez un nouveau lien depuis la page de connexion.");
  await signInUser(userId);
  const { db } = await import("@/lib/db");
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  redirect(safeNextPath(parsed.data.next) ?? (user ? homePathForRole(user.role) : "/"));
}

export async function signOutAction(): Promise<void> {
  await signOutCurrent();
  redirect("/");
}
