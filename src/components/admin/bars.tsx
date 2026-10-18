import { cn } from "@/lib/utils";

/** Dependency-free bar chart (CSS only) for small daily series. */
export function Bars({ data, label, className }: { data: Array<{ label: string; value: number }>; label: string; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className={cn("space-y-2", className)}>
      <div className="flex h-28 items-end gap-0.5" role="img" aria-label={`${label} : ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center justify-end" title={`${d.label} : ${d.value}`}>
            <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(2, Math.round((d.value / max) * 100))}%` }} />
          </div>
        ))}
      </div>
      <figcaption className="flex justify-between text-[11px] text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </figcaption>
    </figure>
  );
}
