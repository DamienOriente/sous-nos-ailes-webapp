import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Paywall } from "@/components/billing/paywall";
import { PageHeader } from "@/components/shared/page-header";
import { ConnectionCard, type ConnectionView } from "@/components/calendar/connection-card";
import { PaymentRequiredError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { listConnections, listExternalCalendars, requireCalendarSyncEntitlement } from "@/modules/calendar/application/connections-service";
import { isProviderConfigured, PROVIDER_LABELS } from "@/modules/calendar/infrastructure/adapters";
import type { CalendarProvider } from "@/modules/calendar/infrastructure/provider-adapter";
import { disconnectAction, syncNowAction, updateConnectionOptionsAction } from "../actions";

export const metadata = { title: "Connexions calendrier" };

const PROVIDERS: CalendarProvider[] = ["google", "microsoft"];

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const actor = await requireActor("/app/calendrier/connexions");
  const sp = await searchParams;
  try {
    await requireCalendarSyncEntitlement(actor);
  } catch (e) {
    if (e instanceof PaymentRequiredError) {
      return (
        <Paywall
          feature="calendar.sync"
          audience="professional"
          description="Synchronisez vos prestations et indisponibilités avec Google Agenda ou Outlook, dans les deux sens, avec détection des conflits. Inclus dans Professionnel Premium ; gratuit pour les organisateurs sans fiche pro."
          backHref="/app/calendrier"
          backLabel="Retour au calendrier"
        />
      );
    }
    throw e;
  }
  const connections = await listConnections(actor);
  const views: ConnectionView[] = await Promise.all(
    connections.map(async (c) => ({
      id: c.id,
      provider: c.provider,
      label: PROVIDER_LABELS[c.provider],
      externalAccountEmail: c.externalAccountEmail,
      externalCalendarId: c.externalCalendarId,
      status: c.status,
      syncDirection: c.syncDirection,
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      lastError: c.lastError,
      calendars: c.status === "active" ? (await listExternalCalendars(actor, c.id)).map((x) => ({ id: x.id, name: x.name, primary: x.primary })) : [],
      recentJobs: c.recentJobs.map((j) => ({ id: j.id, status: j.status, pushed: j.pushed, pulled: j.pulled, conflicts: j.conflicts, error: j.error, createdAt: j.createdAt.toISOString() })),
    })),
  );

  return (
    <div className="space-y-6">
      <Link href="/app/calendrier" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Calendrier</Link>
      <PageHeader title="Connexions Google / Outlook" description="OAuth 2.0 avec PKCE, permissions minimales (évènements du calendrier choisi), jetons chiffrés au repos. Par défaut, seules vos entrées internes sont exportées." />
      {sp.connected && (
        <Alert>
          <AlertTitle>Calendrier connecté</AlertTitle>
          <AlertDescription>Choisissez le calendrier cible et la direction, puis lancez une première synchronisation.</AlertDescription>
        </Alert>
      )}
      {sp.error && (
        <Alert className="border-destructive/40">
          <AlertTitle>Connexion impossible</AlertTitle>
          <AlertDescription>{decodeURIComponent(sp.error)}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const existing = views.find((v) => v.provider === provider);
          const configured = isProviderConfigured(provider);
          if (existing) {
            return (
              <ConnectionCard
                key={provider}
                connection={existing}
                onUpdate={updateConnectionOptionsAction.bind(null, existing.id)}
                onSync={syncNowAction.bind(null, existing.id)}
                onDisconnect={disconnectAction.bind(null, existing.id)}
                reconnectHref={`/api/integrations/${provider}/start`}
              />
            );
          }
          return (
            <Card key={provider} className="gap-4 p-6" data-testid={`connection-${provider}`}>
              <div>
                <h3 className="font-semibold">{PROVIDER_LABELS[provider]}</h3>
                <p className="text-sm text-muted-foreground">{provider === "google" ? "Portée demandée : évènements du calendrier + liste des calendriers (lecture)." : "Portée demandée : Calendars.ReadWrite + offline_access."}</p>
              </div>
              {configured ? (
                <Button asChild className="w-fit">
                  <a href={`/api/integrations/${provider}/start`}>Connecter {PROVIDER_LABELS[provider]}</a>
                </Button>
              ) : (
                <Alert>
                  <AlertTitle>Intégration non activée sur cette instance</AlertTitle>
                  <AlertDescription>
                    L'administrateur doit renseigner les identifiants OAuth ({provider === "google" ? "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET" : "MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET"}).{" "}
                    <Link href="/docs/integrations" className="underline">
                      Documentation
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
