import type { Metadata } from "next";
import Link from "next/link";
import { HoldActionButton } from "@/components/brief/hold-buttons";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireActor } from "@/lib/session";
import { getRetroplanning } from "@/modules/events/application/retroplanning-service";
import { BOOKING_STATE_LABELS, type BookingState } from "@/modules/events/domain/retroplanning";
import { guardPage } from "../_guards";
import { addRetroplanningTasksAction } from "./actions";

export const metadata: Metadata = { title: "Rétroplanning" };

const TONES: Record<BookingState, "success" | "info" | "danger" | "warning" | "neutral"> = { booked: "success", in_progress: "info", late: "danger", now: "warning", upcoming: "neutral" };

function month(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}
function day(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

/** What to book, and when, counted back from the event date. */
export default async function RetroplanningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/retroplanning`);
  const view = await guardPage(() => getRetroplanning(actor, id));
  if (!view.eventDate) {
    return (
      <div className="space-y-6">
        <PageHeader title="Rétroplanning" description="Ce qu'il faut réserver, et quand, à partir de la date de l'évènement." />
        <EmptyState
          title="Fixez d'abord la date"
          description="Le rétroplanning se calcule à partir de la date de l'évènement."
          action={
            <Link href={`/app/evenements/${id}/brief`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Renseigner la date
            </Link>
          }
        />
      </div>
    );
  }
  const months = new Map<string, typeof view.items>();
  for (const i of view.items) months.set(month(i.targetDate), [...(months.get(month(i.targetDate)) ?? []), i]);
  const pending = view.items.filter((i) => i.state !== "booked" && !i.hasTask).length;
  return (
    <div className="space-y-8">
      <PageHeader
        title="Rétroplanning"
        description="Ce qu'il faut réserver, et quand, compté à partir de la date de l'évènement. Les délais sont des repères usuels : les métiers les plus demandés se réservent en premier."
        actions={view.canAddTasks && pending > 0 ? <HoldActionButton run={addRetroplanningTasksAction.bind(null, id)} label={`Ajouter ${pending} réservation${pending > 1 ? "s" : ""} à mes tâches`} done="Réservations ajoutées aux tâches." variant="default" /> : undefined}
      />
      <ol className="space-y-8" data-testid="retroplanning">
        {[...months.entries()].map(([m, items]) => (
          <li key={m}>
            <h2 className="text-lg font-semibold first-letter:uppercase">{m}</h2>
            <ul className="mt-3 divide-y rounded-2xl border bg-card">
              {items.map((i) => (
                <li key={i.categorySlug} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid="retro-item">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {i.label}
                      <span className="ml-2 font-normal text-muted-foreground">avant le {day(i.targetDate)}</span>
                    </p>
                    <p className="text-muted-foreground text-pretty">{i.why}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <StatusBadge tone={TONES[i.state]}>{BOOKING_STATE_LABELS[i.state]}</StatusBadge>
                    {i.state !== "booked" && (
                      <Link href={`/annuaire/${i.categorySlug}?date=${view.eventDate}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        Voir les {i.categoryName.toLowerCase()} libres
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
