import { CANVAS, seatPoints, type TableShape } from "@/modules/seating/domain/geometry";
import { TableShapeSvg } from "./table-shape";

const DEMO: Array<{ name: string; shape: TableShape; capacity: number; x: number; y: number; used: number }> = [
  { name: "Mariés", shape: "rectangle", capacity: 10, x: 500, y: 110, used: 10 },
  { name: "Famille Marchand", shape: "round", capacity: 8, x: 220, y: 300, used: 8 },
  { name: "Famille Lisa", shape: "round", capacity: 8, x: 500, y: 320, used: 7 },
  { name: "Amis", shape: "oval", capacity: 10, x: 790, y: 300, used: 9 },
  { name: "Collègues", shape: "square", capacity: 6, x: 260, y: 540, used: 4 },
  { name: "Enfants", shape: "round", capacity: 8, x: 740, y: 540, used: 6 },
];

/** Static illustration used inside the paywall: shows what the editor looks like without any data. */
export function SeatingStaticPreview() {
  return (
    <svg viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`} className="h-auto w-full" role="img" aria-label="Exemple de plan de table avec six tables">
      <rect width={CANVAS.width} height={CANVAS.height} fill="var(--card)" />
      {DEMO.map((t) => (
        <g key={t.name} transform={`translate(${t.x} ${t.y})`}>
          <TableShapeSvg shape={t.shape} capacity={t.capacity} over={false} />
          {seatPoints(t.shape, t.capacity).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={5} fill={i < t.used ? "var(--primary)" : "var(--muted)"} stroke="var(--border)" />
          ))}
          <text textAnchor="middle" dy="-2" fontSize={14} fontWeight={600} fill="var(--foreground)">
            {t.name}
          </text>
          <text textAnchor="middle" dy="16" fontSize={12} fill="var(--muted-foreground)">
            {t.used}/{t.capacity}
          </text>
        </g>
      ))}
    </svg>
  );
}
