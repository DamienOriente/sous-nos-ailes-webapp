import type { Metadata } from "next";
import { requireProvider } from "@/server/authz";
import { listAvailabilitiesForProvider } from "@/server/services/portal-extras";
import { getSettings } from "@/server/services/settings";
import { removeAvailabilityAction } from "@/server/actions/portal/provider";
import { formatInstantParis } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { LabelCard } from "@/components/ui/label-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashAlerts } from "@/components/portal/flash-alerts";
import { readFlash } from "@/components/portal/flash";
import { AvailabilityForm } from "@/components/portal/availability-form";
import { SubmitButton } from "@/components/portal/submit-button";

export const metadata: Metadata = { title: "Mes disponibilités" };

type AvailabilityRow = Awaited<ReturnType<typeof listAvailabilitiesForProvider>>["upcoming"][number];

function AvailabilityList({ rows, removable }: { rows: AvailabilityRow[]; removable: boolean }) {
  return (
    <ul className="divide-y divide-sage-100 rounded-md border border-sage-200 bg-ivory-50">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex min-w-0 flex-col gap-1">
            <StatusBadge tone={row.kind === "AVAILABLE" ? "sage" : "warning"} className="self-start">
              {row.kind === "AVAILABLE" ? "Disponible" : "Indisponible"}
            </StatusBadge>
            <span className="text-[15px] text-ink-900 tabular">
              {formatInstantParis(row.startsAt)} → {formatInstantParis(row.endsAt)}
            </span>
            {row.note ? <span className="text-sm text-ink-500">{row.note}</span> : null}
          </span>
          {removable ? (
            <form action={removeAvailabilityAction.bind(null, row.id)} className="shrink-0">
              <SubmitButton variant="ghost" size="sm" pendingLabel="Retrait…">
                Retirer
              </SubmitButton>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function ProviderAvailabilitiesPage({ searchParams }: PageProps<"/espace-intervenant/disponibilites">) {
  const { profile } = await requireProvider("/espace-intervenant/disponibilites");
  const [{ upcoming, past }, settings, query] = await Promise.all([listAvailabilitiesForProvider(profile.id), getSettings(), searchParams]);
  const flash = readFlash(query);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Mes disponibilités"
        description={`Indiquez les périodes où vous pouvez intervenir et celles où vous ne le pouvez pas. ${settings.ownerFirstName} s’en sert pour vous proposer des missions compatibles.`}
      />
      <FlashAlerts flash={flash} />

      <section aria-labelledby="availabilities-title" className="flex flex-col gap-4">
        <h2 id="availabilities-title" className="font-sans text-lg font-semibold text-ink-900">
          Périodes déclarées
        </h2>
        {upcoming.length ? (
          <AvailabilityList rows={upcoming} removable />
        ) : (
          <EmptyState title="Aucune période à venir" description="Ajoutez vos disponibilités ou indisponibilités ci-dessous. Les horaires sont exprimés en heure de Paris." />
        )}
        {past.length ? (
          <details className="rounded-md border border-sage-200 bg-ivory-50">
            <summary className="cursor-pointer px-4 py-3 text-[15px] font-semibold text-ink-700">
              Périodes passées <span className="font-medium text-ink-500 tabular">({past.length})</span>
            </summary>
            <div className="border-t border-sage-200 p-3">
              <AvailabilityList rows={past} removable />
            </div>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="add-title" className="flex flex-col gap-4">
        <h2 id="add-title" className="font-sans text-lg font-semibold text-ink-900">
          Ajouter une période
        </h2>
        <LabelCard>
          <AvailabilityForm />
        </LabelCard>
      </section>
    </div>
  );
}
