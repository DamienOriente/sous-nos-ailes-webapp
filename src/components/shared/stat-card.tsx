import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Figure + label. No decorative icon: the number is the content. `icon` and `tone` are accepted for compatibility and ignored. */
export function StatCard({ label, value, hint, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: unknown; tone?: "default" | "warning" | "success"; className?: string }) {
  return (
    <Card className={cn("gap-1 px-5 py-4", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
