import { EmptyNestScene } from "@/components/illustrations";
import { cn } from "@/lib/utils";

/**
 * Empty state with the "empty nest" scene: the illustration sets the tone,
 * the copy says what will appear here and what to do meanwhile. Role=status
 * like the shared EmptyState so screen readers announce it once.
 */
export function IllustratedEmpty({
  title,
  description,
  action,
  scene: Scene = EmptyNestScene,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  scene?: React.ComponentType<{ className?: string }>;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("grid items-center gap-6 rounded-2xl border border-dashed bg-card/60 p-6 sm:grid-cols-[minmax(0,220px)_1fr] sm:p-8", className)} role="status">
      <Scene className="mx-auto w-full max-w-[220px]" />
      <div className="text-center sm:text-left">
        <h3 className="font-heading text-lg font-semibold">{title}</h3>
        {description && <p className="mt-1 max-w-prose text-sm text-muted-foreground text-pretty">{description}</p>}
        {children}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
