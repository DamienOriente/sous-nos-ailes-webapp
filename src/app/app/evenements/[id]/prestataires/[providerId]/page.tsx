import Link from "next/link";
import { ChevronLeft, ExternalLink, FileText } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { eventBudgetLines } from "@/db/schema";
import { DeleteProviderButton, InviteDialog, ProviderDetailsForm, ProviderStatusActions, RevokeAccessButton } from "@/components/events/provider-forms";
import { FormMessage, StatusBadge } from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/lib/session";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { EVENT_ROLE_LABELS, type EventRole } from "@/modules/authorization";
import { getCategoryOptions } from "@/modules/events/application/categories";
import { getEventForMember } from "@/modules/events/application/event-service";
import { getProvider } from "@/modules/events/application/provider-service";
import { PROVIDER_STATUS_LABELS, PROVIDER_STATUS_TONES } from "@/modules/events/domain/providers";
import { privateFileHref } from "@/modules/files/application/file-urls";
import { guardPage } from "../../_guards";
import { changeProviderStatusAction, deleteProviderAction, inviteProviderAction, revokeProviderAccessAction, updateProviderAction } from "../actions";

function localDateTime(d: Date | null, timeZone: string) {
  if (!d) return { date: null, time: null };
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export default async function ProviderDetailPage({ params, searchParams }: { params: Promise<{ id: string; providerId: string }>; searchParams: Promise<{ ajout?: string }> }) {
  const { id, providerId } = await params;
  const { ajout } = await searchParams;
  const actor = await requireActor(`/app/evenements/${id}/prestataires/${providerId}`);
  const { event, provider, access } = await guardPage(async () => {
    const event = await getEventForMember(actor, id);
    const { provider, access } = await getProvider(actor, id, providerId);
    return { event, provider, access };
  });
  const canManage = access.permissions.has("event.providers.manage");
  const canInvite = access.permissions.has("event.members.manage");
  const categories = canManage ? await getCategoryOptions() : [];
  const budgetLines = canManage ? await db.select({ id: eventBudgetLines.id, label: eventBudgetLines.label, eventProfessionalId: eventBudgetLines.eventProfessionalId }).from(eventBudgetLines).where(eq(eventBudgetLines.eventId, id)) : [];
  const linkedLine = budgetLines.find((l) => l.eventProfessionalId === providerId);
  const start = localDateTime(provider.serviceStartsAt, event.timezone);
  const end = localDateTime(provider.serviceEndsAt, event.timezone);

  return (
    <div className="space-y-6">
      <Link href={`/app/evenements/${id}/prestataires`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Prestataires
      </Link>
      {ajout === "1" && <FormMessage success="Professionnel ajouté à votre présélection. Il n'a pas encore été contacté : envoyez-lui une demande ou une invitation." />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">{provider.categoryName ?? "Catégorie non précisée"}</p>
          <h1 className="font-heading text-2xl font-semibold">{provider.displayName}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge tone={PROVIDER_STATUS_TONES[provider.status]}>{PROVIDER_STATUS_LABELS[provider.status]}</StatusBadge>
            <span>{provider.isExternal ? "Prestataire externe (fiche privée, jamais publiée)" : "Professionnel de la plateforme"}</span>
            {provider.proSlug && (
              <Link href={`/pro/${provider.proSlug}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                Voir la fiche publique <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
        {canManage && <ProviderStatusActions eventId={id} providerId={providerId} status={provider.status} action={changeProviderStatusAction} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Fiche interne</CardTitle>
                <CardDescription>Coordonnées, devis, contrat et horaires de prestation. Visible des organisateurs seulement.</CardDescription>
              </CardHeader>
              <CardContent>
                <ProviderDetailsForm
                  eventId={id}
                  providerId={providerId}
                  value={{
                    externalName: provider.isExternal ? provider.displayName : null,
                    externalEmail: provider.externalEmail,
                    externalPhone: provider.externalPhone,
                    isExternal: provider.isExternal,
                    categorySlug: provider.categorySlug,
                    notes: provider.notes,
                    quoteCents: provider.quoteCents,
                    quoteFileId: provider.quoteFileId,
                    contractFileId: provider.contractFileId,
                    serviceDate: start.date,
                    serviceStart: start.time,
                    serviceEnd: end.time,
                    budgetLineId: linkedLine?.id ?? null,
                  }}
                  categories={categories}
                  budgetLines={budgetLines.map((l) => ({ id: l.id, label: l.label }))}
                  action={updateProviderAction}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Prestation</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {provider.serviceStartsAt ? (
                  <p>
                    {formatDateFr(provider.serviceStartsAt, { weekday: "long", day: "numeric", month: "long" }, event.timezone)} · {start.time}
                    {end.time ? ` – ${end.time}` : ""}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Horaires de prestation non encore définis.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Accès à l'espace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {provider.memberStatus === "active" ? (
                <>
                  <p>
                    <span className="font-medium">{provider.memberUserName}</span> a rejoint l'équipe en tant que {EVENT_ROLE_LABELS[(provider.memberRole ?? "provider") as EventRole].toLowerCase()}.
                  </p>
                  {canInvite && provider.memberId && <RevokeAccessButton eventId={id} memberId={provider.memberId} action={revokeProviderAccessAction} />}
                </>
              ) : provider.pendingInvitationId ? (
                <>
                  <p className="text-muted-foreground">
                    Invitation envoyée{provider.pendingInvitationEmail ? ` à ${provider.pendingInvitationEmail}` : ""}, valable jusqu'au {provider.pendingInvitationExpiresAt ? formatDateFr(provider.pendingInvitationExpiresAt) : "—"}.
                  </p>
                  {canInvite && <InviteDialog eventId={id} eventProfessionalId={providerId} defaultEmail={provider.externalEmail} defaultName={provider.isExternal ? provider.displayName : null} categorySlug={provider.categorySlug} categories={categories} action={inviteProviderAction} triggerLabel="Renvoyer une invitation" />}
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">Ce prestataire n'a pas encore accès à l'espace de coordination (planning, messages, documents partagés).</p>
                  {canInvite && <InviteDialog eventId={id} eventProfessionalId={providerId} defaultEmail={provider.externalEmail} defaultName={provider.isExternal && !provider.displayName.startsWith("À trouver") ? provider.displayName : null} categorySlug={provider.categorySlug} categories={categories} action={inviteProviderAction} />}
                </>
              )}
            </CardContent>
          </Card>
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Résumé</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Devis</span>
                  <span className="tabular-nums">{provider.quoteCents !== null ? formatEuros(provider.quoteCents) : "—"}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Ligne budget</span>
                  <span>{linkedLine?.label ?? "—"}</span>
                </p>
                {provider.quoteFileId && (
                  <a href={privateFileHref(provider.quoteFileId)} className="inline-flex items-center gap-1.5 text-primary hover:underline" target="_blank" rel="noreferrer">
                    <FileText className="size-4" aria-hidden="true" /> Devis (fichier)
                  </a>
                )}
                {provider.contractFileId && (
                  <a href={privateFileHref(provider.contractFileId)} className="inline-flex items-center gap-1.5 text-primary hover:underline" target="_blank" rel="noreferrer">
                    <FileText className="size-4" aria-hidden="true" /> Contrat (fichier)
                  </a>
                )}
                <div className="pt-2">
                  <DeleteProviderButton eventId={id} providerId={providerId} label={provider.displayName} action={deleteProviderAction} />
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
