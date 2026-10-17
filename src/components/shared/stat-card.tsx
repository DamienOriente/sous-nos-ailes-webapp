import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, hint, icon: Icon, tone = "default", className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: "default" | "warning" | "success"; className?: string }) {
  return (
    <Card className={cn("gap-1 px-5 py-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("size-4", tone === "warning" ? "text-warning-foreground" : tone === "success" ? "text-success" : "text-muted-foreground")} aria-hidden="true" />}
      </div>
      <p className="font-heading text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
