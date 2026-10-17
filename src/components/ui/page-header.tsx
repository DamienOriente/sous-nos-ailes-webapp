import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Header for private spaces: plain, scannable, no decorative kicker. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 border-b border-sage-200 pb-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-ink-900 md:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[15px] leading-snug text-ink-500">{description}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
