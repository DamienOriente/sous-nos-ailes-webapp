import { tableFootprint, type TableShape } from "@/modules/seating/domain/geometry";

/** SVG drawing of one table, centred on (0,0); the parent applies the translate/rotate. */
export function TableShapeSvg({ shape, capacity, over, selected }: { shape: TableShape; capacity: number; over: boolean; selected?: boolean }) {
  const { w, h } = tableFootprint(shape, capacity);
  const stroke = over ? "var(--destructive)" : selected ? "var(--primary)" : "var(--sna-sage-deep, #4f6b55)";
  const fill = over ? "color-mix(in oklch, var(--destructive) 12%, white)" : "var(--sna-sand, #f3efe6)";
  const common = { fill, stroke, strokeWidth: selected ? 3 : 1.5 };
  if (shape === "round") return <circle r={w / 2} {...common} />;
  if (shape === "oval") return <ellipse rx={w / 2} ry={h / 2} {...common} />;
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={shape === "square" ? 10 : 8} {...common} />;
}
