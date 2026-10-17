import { db } from "@/lib/db";
import type { ApplicationKind, ApplicationStatus } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";
import { sendMail } from "@/lib/mail";
import { getEnv } from "@/lib/env";
import { getSettings } from "@/server/services/settings";
import { recordAudit } from "@/server/services/audit";

export async function submitApplication(kind: ApplicationKind, input: { name: string; email: string; phone?: string | null; city?: string | null; organisation?: string | null; sector?: string | null; message: string }): Promise<string> {
  const application = await db.application.create({ data: { kind, ...input, privacyAcceptedAt: new Date() } });
  const settings = await getSettings();
  const env = getEnv();
  await sendMail(
    {
      to: input.email,
      subject: kind === "PROVIDER" ? "Votre candidature est bien reçue" : "Votre demande de partenariat est bien reçue",
      template: "application-acknowledgement",
      heading: "Merci pour votre message",
      paragraphs: [`Bonjour ${input.name},`, `${settings.ownerFirstName} a bien reçu votre ${kind === "PROVIDER" ? "candidature" : "demande de partenariat"} et vous répondra personnellement.`],
      entityType: "Application",
      entityId: application.id,
    },
    settings.brandName,
  );
  await sendMail(
    {
      to: settings.contactEmail,
      subject: `${kind === "PROVIDER" ? "Nouvelle candidature" : "Nouvelle demande de partenariat"} — ${input.name}`,
      template: "application-admin-notification",
      heading: kind === "PROVIDER" ? "Nouvelle candidature" : "Nouvelle demande de partenariat",
      paragraphs: [`${input.name}${input.organisation ? ` (${input.organisation})` : ""}${input.city ? `, ${input.city}` : ""}.`],
      cta: { label: "Voir dans l’administration", url: `${env.APP_URL}/admin/candidatures` },
      entityType: "Application",
      entityId: application.id,
    },
    settings.brandName,
  );
  return application.id;
}

export async function submitContactMessage(input: { name: string; email: string; subject?: string | null; message: string }): Promise<string> {
  const message = await db.contactMessage.create({ data: { ...input, privacyAcceptedAt: new Date() } });
  const settings = await getSettings();
  await sendMail(
    {
      to: settings.contactEmail,
      subject: `Message de contact — ${input.subject || input.name}`,
      template: "contact-admin-notification",
      heading: "Nouveau message de contact",
      paragraphs: [`De ${input.name} (${input.email})`, input.message],
      entityType: "ContactMessage",
      entityId: message.id,
    },
    settings.brandName,
  );
  return message.id;
}

export async function listApplications() {
  return db.application.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
}

export async function listContactMessages() {
  return db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function setApplicationStatus(applicationId: string, status: ApplicationStatus, note: string | null, actor: SessionUser): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.application.update({ where: { id: applicationId }, data: { status, reviewNote: note, reviewedAt: new Date() } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "application.status", entityType: "Application", entityId: applicationId, summary: status }, tx);
  });
}

export async function markContactHandled(messageId: string): Promise<void> {
  await db.contactMessage.update({ where: { id: messageId }, data: { handledAt: new Date() } });
}
