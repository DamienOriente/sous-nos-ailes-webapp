import Link from "next/link";
import { Search } from "lucide-react";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { ExternalProviderDialog } from "@/components/events/provider-forms";
import { HandshakeScene } from "@/components/illustrations/event-scenes";
import { PageHeader, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { requireActor } from "@/lib/session";
import { formatEuros } from "@/lib/utils";
import { getCategoryOptions } from "@/modules/events/application/categories";
import { getEventForMember } from "@/modules/events/application/event-service";
import { listProviders } from "@/modules/events/application/provider-service";
import { PROVIDER_STATUS_LABELS, PROVIDER_STATUS_TONES } from "@/modules/events/domain/providers";
import { guardPage } from "../_guards";
import { createExternalProviderAction } from "./actions";

export default async function ProvidersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/prestataires`);
  const { event, providers, access } = await guardPage(async () => {
    const event = await getEventForMember(actor, id);
    const { providers, access } = await listProviders(actor, id);
    return { event, providers, access };
  });
  const canManage = access.permissions.has("event.providers.manage");
  const categories = await getCategoryOptions();
  const groups = new Map<string, typeof providers>();
  for (const p of providers) {
    const k = p.categoryName ?? "Sans catégorie";
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  const base = `/app/evenements/${id}/prestataires`;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Prestataires"
        description={canManage ? "Vos professionnels par catégorie : de la présélection à la confirmation, avec devis et contrats." : "Les professionnels qui interviennent sur cet évènement."}
        actions={
          canManage && providers.length > 0 ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/annuaire?event=${id}&department=${encodeURIComponent(event.department ?? "")}`}>
                  <Search className="size-4" aria-hidden="true" />
                  Rechercher dans l'annuaire
                </Link>
              </Button>
              <ExternalProviderDialog eventId={id} categories={categories} action={createExternalProviderAction} />
            </>
          ) : undefined
        }
      />
      {providers.length === 0 ? (
        <IllustratedEmpty
          scene={HandshakeScene}
          title="Aucun prestataire pour l'instant"
          description={canManage ? "Un prestataire suit un parcours : présélectionné → demande envoyée → devis reçu → confirmé. Depuis l'annuaire, un professionnel vérifié rejoint votre présélection en un clic ; vous pouvez aussi noter un prestataire que vous connaissez déjà." : "Les professionnels confirmés par l'organisateur apparaîtront ici."}
          example="Domaine des Tilleuls — lieu de réception, devis reçu : 8 500 €"
          action={canManage ? <><Button asChild variant="outline"><Link href={`/annuaire?event=${id}&department=${encodeURIComponent(event.department ?? "")}`}><Search className="size-4" aria-hidden="true" />Rechercher dans l'annuaire</Link></Button><ExternalProviderDialog eventId={id} categories={categories} action={createExternalProviderAction} /></> : undefined}
          testId="providers-empty"
        />
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([category, list]) => (
            <section key={category} aria-labelledby={`cat-${category}`} className="space-y-2">
              <h2 id={`cat-${category}`} className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {category}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((p) => (
                  <li key={p.id}>
                    <Link href={`${base}/${p.id}`} className="flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">{p.displayName}</span>
                        <StatusBadge tone={PROVIDER_STATUS_TONES[p.status]}>{PROVIDER_STATUS_LABELS[p.status]}</StatusBadge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.isExternal ? (p.displayName.startsWith("À trouver") ? "Place à pourvoir" : "Prestataire externe") : "Professionnel de la plateforme"}
                        {p.memberStatus === "active" ? " · a rejoint l'équipe" : p.pendingInvitationId ? " · invitation en attente" : ""}
                      </p>
                      <div className="mt-auto flex items-center justify-between text-sm">
                        <span className="tabular-nums">{p.quoteCents !== null ? formatEuros(p.quoteCents) : canManage ? "Pas de devis" : ""}</span>
                        {p.serviceStartsAt && <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: event.timezone }).format(p.serviceStartsAt)}{p.serviceEndsAt ? `–${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: event.timezone }).format(p.serviceEndsAt)}` : ""}</span>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
