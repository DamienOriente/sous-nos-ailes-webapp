import { cn } from "@/lib/utils";
import type { WeeklyPoint } from "@/modules/professionals/application/stats-service";

/**
 * Bars drawn with CSS only (no chart library): one column per week, inquiries
 * received in the primary colour, confirmed ones stacked on top. The table
 * underneath (visually hidden) carries the exact numbers for assistive tech.
 */
function weekLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

export function WeeklyChart({ weeks, className }: { weeks: WeeklyPoint[]; className?: string }) {
  const max = Math.max(1, ...weeks.map((w) => w.inquiries));
  const total = weeks.reduce((a, w) => a + w.inquiries, 0);
  return (
    <figure className={cn("space-y-3", className)}>
      <div className="grid h-44 items-end gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {weeks.map((w) => {
          const h = Math.round((w.inquiries / max) * 100);
          const c = w.inquiries > 0 ? Math.round((w.confirmed / w.inquiries) * 100) : 0;
          return (
            <div key={w.weekStart} className="flex h-full flex-col justify-end" title={`Semaine du ${weekLabel(w.weekStart)} : ${w.inquiries} demande${w.inquiries > 1 ? "s" : ""}, ${w.confirmed} confirmée${w.confirmed > 1 ? "s" : ""}`}>
              <div className="relative w-full overflow-hidden rounded-t-md bg-primary/25 transition-[height] motion-reduce:transition-none" style={{ height: `${Math.max(h, w.inquiries > 0 ? 6 : 2)}%` }}>
                <div className="absolute inset-x-0 bottom-0 bg-primary" style={{ height: `${c}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
        <span>{weekLabel(weeks[0]?.weekStart ?? "")}</span>
        <span>cette semaine</span>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary/25" aria-hidden="true" />
          Demandes reçues ({total} sur {weeks.length} semaines)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />
          Acceptées ou confirmées
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Demandes reçues par semaine</caption>
        <thead>
          <tr>
            <th scope="col">Semaine du</th>
            <th scope="col">Demandes</th>
            <th scope="col">Confirmées</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekStart}>
              <th scope="row">{weekLabel(w.weekStart)}</th>
              <td>{w.inquiries}</td>
              <td>{w.confirmed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
