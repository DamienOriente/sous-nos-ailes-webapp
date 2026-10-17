import { cn } from "@/lib/utils";

/**
 * Dependency-free sparkline (inline SVG, CSS tokens) for a daily series. The
 * accessible name lists the total and the last value; the figure itself is
 * decorative. `tone` follows the card it sits in.
 */
export function Sparkline({ data, label, tone = "primary", className }: { data: Array<{ day: string; count: number }>; label: string; tone?: "primary" | "warning" | "sky" | "blush"; className?: string }) {
  const w = 120;
  const h = 32;
  const max = Math.max(1, ...data.map((d) => d.count));
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((d, i) => [i * step, h - 2 - (d.count / max) * (h - 4)] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const total = data.reduce((s, d) => s + d.count, 0);
  const last = data[data.length - 1]?.count ?? 0;
  const stroke = { primary: "var(--sna-sage-deep)", warning: "var(--warning)", sky: "var(--sna-sky-deep)", blush: "var(--sna-blush-deep)" }[tone];
  return (
    <figure className={cn("space-y-1", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none" role="img" aria-label={`${label} : ${total} sur ${data.length} jours, ${last} le dernier jour`}>
        <path d={area} fill={stroke} opacity="0.12" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {points.length > 0 && <circle cx={points[points.length - 1]![0]} cy={points[points.length - 1]![1]} r="2.2" fill={stroke} />}
      </svg>
      <figcaption className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{data[0]?.day.slice(5) ?? ""}</span>
        <span>{total} sur 30 j</span>
      </figcaption>
    </figure>
  );
}
