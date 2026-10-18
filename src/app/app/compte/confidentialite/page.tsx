import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { DeleteAccountButton, ResetConsentButton } from "@/components/privacy/account-privacy-controls";
import { CookiePreferences } from "@/components/privacy/cookie-preferences";
import { DsrForm } from "@/components/privacy/dsr-form";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/utils";
import { requireActor } from "@/lib/session";
import { listConsentHistory } from "@/modules/privacy/application/consent-service";
import { EXPORT_EXCLUDED } from "@/modules/privacy/application/data-export";
import { listMyDataSubjectRequests } from "@/modules/privacy/application/dsr-service";
import { CONSENT_COOKIE_NAME, parseConsent } from "@/modules/privacy/domain/consent";
import { DSR_KIND_LABELS, DSR_STATUS_LABELS, dueTone } from "@/modules/privacy/domain/dsr";

export const metadata: Metadata = { title: "Confidentialité de mon compte" };

const PURPOSE_LABELS: Record<string, string> = {
  cookies_analytics: "Cookies : mesure d'audience",
  cookies_marketing: "Cookies : marketing",
  marketing_emails: "E-mails marketing",
  terms: "Conditions d'utilisation",
  privacy_policy: "Politique de confidentialité",
  child_health_data: "Données de santé d'un enfant",
};
const GRANTED_LABELS: Record<string, string> = { granted: "Accepté", denied: "Refusé", withdrawn: "Retiré" };

export default async function AccountPrivacyPage() {
  const actor = await requireActor("/app/compte/confidentialite");
  const jar = await cookies();
  const consentState = parseConsent(jar.get(CONSENT_COOKIE_NAME)?.value);
  const [requests, consents] = await Promise.all([listMyDataSubjectRequests(actor), listConsentHistory(actor.userId, consentState?.anonymousId ?? null)]);
  const hasOpenErasure = requests.some((r) => r.kind === "erasure" && (r.status === "received" || r.status === "in_progress"));

  return (
    <div className="space-y-10">
      <PageHeader
        title="Confidentialité et données personnelles"
        description="Exportez vos données, exercez vos droits, consultez vos consentements. Tout ce qui est ici vous concerne vous, et seulement vous."
      />

      <section aria-labelledby="export-title" className="rounded-2xl border bg-card p-6">
        <h2 id="export-title" className="text-lg font-semibold">
          Télécharger une copie de mes données
        </h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">Fichier JSON généré à la demande : votre compte, votre profil, les métadonnées de vos évènements et fiches, votre carnet de contacts, vos consentements et vos demandes.</p>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Ce que l'export ne contient pas</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {EXPORT_EXCLUDED.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
        <Button asChild className="mt-4 rounded-full">
          <a href="/app/compte/confidentialite/export" download>
            Télécharger (JSON)
          </a>
        </Button>
      </section>

      <section aria-labelledby="rights-title" className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <h2 id="rights-title" className="text-lg font-semibold">
            Exercer un droit
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground text-pretty">
            Rectification, limitation, opposition, portabilité. Nous répondons sous un mois.{" "}
            <Link href="/droits-rgpd" className="font-medium text-primary underline underline-offset-4">
              En savoir plus
            </Link>
          </p>
          <DsrForm />
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Mes demandes</h2>
          {requests.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucune demande pour l'instant.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {requests.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{DSR_KIND_LABELS[r.kind]}</p>
                    <p className="text-muted-foreground">
                      Déposée le {formatDateFr(r.createdAt)} · {r.completedAt ? `traitée le ${formatDateFr(r.completedAt)}` : `réponse avant le ${formatDateFr(r.dueAt)}`}
                    </p>
                  </div>
                  <StatusBadge tone={dueTone(r.dueAt, r.status)}>{DSR_STATUS_LABELS[r.status]}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="consent-title" className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 id="consent-title" className="sr-only">
            Préférences cookies
          </h2>
          <CookiePreferences />
          <div className="mt-4">
            <ResetConsentButton />
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Historique de mes consentements</h2>
          <p className="mt-1 text-sm text-muted-foreground">Chaque choix est horodaté avec la version de la politique concernée.</p>
          {consents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Aucun consentement enregistré.</p>
          ) : (
            <ul className="mt-3 max-h-80 divide-y overflow-y-auto text-sm">
              {consents.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{PURPOSE_LABELS[c.purpose] ?? c.purpose}</p>
                    <p className="text-muted-foreground">
                      {formatDateFr(c.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {c.policyVersion ? ` · v${c.policyVersion}` : ""}
                      {c.anonymous ? " · avant connexion" : ""}
                    </p>
                  </div>
                  <StatusBadge tone={c.granted === "granted" ? "success" : "neutral"}>{GRANTED_LABELS[c.granted] ?? c.granted}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="delete-title" className="rounded-2xl border border-destructive/30 bg-card p-6">
        <h2 id="delete-title" className="text-lg font-semibold">
          Supprimer mon compte
        </h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          La suppression n'est pas immédiate : une personne de l'équipe traite votre demande sous 30 jours, car certaines obligations légales (facturation, litige en cours) peuvent imposer de conserver temporairement une partie des données. Nous vous confirmons la suppression par e-mail.
        </p>
        <div className="mt-4">
          {hasOpenErasure ? <StatusBadge tone="warning">Demande de suppression en cours de traitement</StatusBadge> : <DeleteAccountButton />}
        </div>
      </section>
    </div>
  );
}
