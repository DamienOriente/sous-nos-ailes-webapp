import { cn } from "@/lib/utils";

/** Empty state: a clear sentence and one action. `icon` is accepted for compatibility and ignored (no decorative icon tiles). */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  icon?: unknown;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center", className)} role="status">
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
