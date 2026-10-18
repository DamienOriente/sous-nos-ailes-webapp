import { cn, formatEuros } from "@/lib/utils";
import type { EventBrief } from "@/modules/events/domain/brief";

function frDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
}

/** The event brief as a provider receives it. Used on the organiser's brief page and in the provider's inquiry. */
export function BriefCard({ brief, title = "Brief de l'évènement", className }: { brief: EventBrief; title?: string; className?: string }) {
  const rows: [string, string | null][] = [
    ["Évènement", brief.eventTypeLabel],
    ["Date", brief.date ? `${frDate(brief.date)}${brief.dateIsTentative ? ", à confirmer" : ""}${brief.startTime ? `, à partir de ${brief.startTime}` : ""}` : null],
    ["Lieu", [brief.venueName, [brief.postalCode, brief.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null],
    ["Invités", brief.guests !== null ? `${brief.guests}${brief.children ? `, dont ${brief.children} enfants` : ""}` : null],
    ["Budget indicatif", brief.budgetCents !== null ? formatEuros(brief.budgetCents) : null],
    ["Style", brief.style],
  ];
  return (
    <section aria-label={title} className={cn("rounded-xl border bg-card p-5", className)} data-testid="brief-card">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={value ? "" : "text-muted-foreground"}>{value ?? "Non renseigné"}</dd>
          </div>
        ))}
      </dl>
      {brief.needs && (
        <div className="mt-4 border-t pt-3 text-sm">
          <p className="text-muted-foreground">Besoins et précisions</p>
          <p className="mt-1 whitespace-pre-line text-pretty">{brief.needs}</p>
        </div>
      )}
    </section>
  );
}
