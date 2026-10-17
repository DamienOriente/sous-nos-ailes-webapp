import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createMagicLink } from "@/lib/auth/magic-link";
import { sendMail } from "@/lib/mail";
import { normalizeEmail, normalizeSingleLine } from "@/lib/sanitize";
import { getSettings } from "@/server/services/settings";
import { recordAudit } from "@/server/services/audit";

let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword("timing-equalizer");
  return dummyHashPromise;
}

/** Verifies email + password. Unknown users still pay the hashing cost (timing). */
export async function authenticateWithPassword(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !user.passwordHash) {
    await verifyPassword(password, await dummyHash());
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  await recordAudit({ actorId: user.id, actorRole: user.role, action: "auth.login.password", entityType: "User", entityId: user.id });
  return user;
}

/** Sends a login link when the address belongs to an active account. Never reveals existence. */
export async function sendMagicLinkIfUserExists(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return;
  const settings = await getSettings();
  const { url } = await createMagicLink(user.id);
  await sendMail(
    {
      to: user.email,
      subject: `Votre lien de connexion — ${settings.brandName}`,
      template: "magic-link",
      heading: "Votre lien de connexion",
      paragraphs: [
        `Bonjour ${user.name},`,
        "Cliquez sur le bouton ci-dessous pour accéder à votre espace. Ce lien est à usage unique et expire dans 20 minutes.",
        "Si vous n’êtes pas à l’origine de cette demande, ignorez simplement ce message.",
      ],
      cta: { label: "Accéder à mon espace", url },
      entityType: "User",
      entityId: user.id,
    },
    settings.brandName,
  );
  await recordAudit({ actorId: user.id, actorRole: user.role, action: "auth.magic-link.sent", entityType: "User", entityId: user.id });
}

export async function findOrCreateClientUser(
  tx: Prisma.TransactionClient,
  input: { email: string; name: string; phone?: string | null },
): Promise<{ userId: string; created: boolean }> {
  const email = normalizeEmail(input.email);
  const existing = await tx.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.phone && input.phone) {
      await tx.user.update({ where: { id: existing.id }, data: { phone: input.phone } });
    }
    return { userId: existing.id, created: false };
  }
  const user = await tx.user.create({
    data: { email, name: normalizeSingleLine(input.name), phone: input.phone ?? null, role: "CLIENT" },
  });
  return { userId: user.id, created: true };
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
}
