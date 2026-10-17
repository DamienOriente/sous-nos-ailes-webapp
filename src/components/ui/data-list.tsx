import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Key/value list used across event files, briefs and recaps. */
export function DataList({ items, className, columns = 1 }: { items: Array<{ label: ReactNode; value: ReactNode }>; className?: string; columns?: 1 | 2 }) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-3", columns === 2 ? "sm:grid-cols-2" : "", className)}>
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-0.5 border-b border-sage-100 pb-2.5 last:border-b-0">
          <dt className="text-[13px] font-semibold tracking-[0.01em] text-ink-500">{item.label}</dt>
          <dd className="text-[15px] leading-snug text-ink-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
