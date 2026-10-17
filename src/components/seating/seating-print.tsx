import { CANVAS, seatPoints } from "@/modules/seating/domain/geometry";
import type { SeatingPlan } from "@/modules/seating/application/seating-service";
import { TableShapeSvg } from "./table-shape";

/** Print layout: plan on the first page, guest list per table on the following ones. */
export function SeatingPrint({ plan }: { plan: SeatingPlan }) {
  return (
    <div className="space-y-8 print:space-y-0">
      <section className="print:break-after-page">
        <h1 className="font-heading text-2xl font-semibold">Plan de table — {plan.eventName}</h1>
        <p className="text-sm text-muted-foreground">
          {plan.tables.length} tables · {plan.totalSeats} places · {plan.totalGuests - plan.unplaced.length}/{plan.totalGuests} invités placés
        </p>
        <svg viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`} className="mt-4 h-auto w-full rounded-xl border print:border-black" role="img" aria-label="Plan de table">
          {plan.tables.map((t) => (
            <g key={t.id} transform={`translate(${t.x} ${t.y})`}>
              <g transform={`rotate(${t.rotation})`}>
                <TableShapeSvg shape={t.shape} capacity={t.capacity} over={t.occupancy.isOver} />
                {seatPoints(t.shape, t.capacity).map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={5} fill={i < t.occupancy.used ? "#4f6b55" : "#e5e1d8"} stroke="#b9b3a6" />
                ))}
              </g>
              <text textAnchor="middle" dy="-2" fontSize={13} fontWeight={600} fill="#2f3437">
                {t.name}
              </text>
              <text textAnchor="middle" dy="15" fontSize={11} fill="#6b7280">
                {t.occupancy.used}/{t.capacity}
              </text>
            </g>
          ))}
        </svg>
      </section>
      <section>
        <h2 className="font-heading text-xl font-semibold">Liste par table</h2>
        <div className="mt-3 columns-1 gap-6 sm:columns-2 lg:columns-3">
          {plan.tables.map((t) => (
            <div key={t.id} className="mb-4 break-inside-avoid rounded-lg border p-3 print:border-black">
              <h3 className="font-medium">
                {t.name} <span className="text-sm text-muted-foreground">({t.guests.length}/{t.capacity})</span>
              </h3>
              <ol className="mt-1 list-decimal pl-5 text-sm">
                {t.guests.map((g) => (
                  <li key={g.id}>
                    {`${g.firstName} ${g.lastName}`.trim()}
                    {g.isChild ? " (enfant)" : ""}
                  </li>
                ))}
                {t.guests.length === 0 && <li className="list-none text-muted-foreground">—</li>}
              </ol>
            </div>
          ))}
          {plan.unplaced.length > 0 && (
            <div className="mb-4 break-inside-avoid rounded-lg border border-dashed p-3">
              <h3 className="font-medium">Non placés ({plan.unplaced.length})</h3>
              <ul className="mt-1 text-sm">
                {plan.unplaced.map((g) => (
                  <li key={g.id}>{`${g.firstName} ${g.lastName}`.trim()}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
