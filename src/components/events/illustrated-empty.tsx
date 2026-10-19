import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

/**
 * Empty state of the event workspace: an illustration, what the section is
 * for, one concrete example of what a first entry looks like, and the action
 * that creates it. Server-safe (the action slot can hold a client button).
 */
export function IllustratedEmpty({
  scene: Scene,
  title,
  description,
  example,
  action,
  compact = false,
  className,
  testId,
}: {
  scene: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  /** Shown as « Par exemple : “…” ». */
  example?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-5 rounded-2xl border border-dashed bg-card/60 px-6 py-10 text-center sm:flex-row sm:text-left", compact ? "sm:py-6" : "sm:py-10", className)} role="status" data-testid={testId}>
      <div className={cn("w-full shrink-0 overflow-hidden rounded-xl bg-muted/40", compact ? "max-w-[9.5rem] sm:w-[9.5rem]" : "max-w-[15rem] sm:w-[15rem]")}>
        <Scene className="aspect-[3/2]" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="font-heading text-lg font-semibold text-balance">{title}</h3>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">{description}</p>
        {example && (
          <p className="max-w-prose text-sm text-pretty">
            <span className="text-muted-foreground">Par exemple : </span>
            <span className="rounded-md bg-accent/70 px-1.5 py-0.5 font-medium text-accent-foreground">« {example} »</span>
          </p>
        )}
        {action && <div className="flex flex-wrap items-center justify-center gap-2 pt-2 sm:justify-start">{action}</div>}
      </div>
    </div>
  );
}
