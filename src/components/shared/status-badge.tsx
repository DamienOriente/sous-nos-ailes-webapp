import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneClass: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  success: "bg-success/15 text-sage-deep border-transparent dark:text-success",
  warning: "bg-warning/20 text-warning-foreground border-transparent",
  danger: "bg-destructive/10 text-destructive border-transparent",
  info: "bg-info/15 text-[oklch(0.42_0.1_235)] border-transparent dark:text-info",
  primary: "bg-primary/10 text-primary border-transparent",
};

export function StatusBadge({ tone = "neutral", children, className, dot = true }: { tone?: StatusTone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full px-2.5 py-0.5 font-medium", toneClass[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </Badge>
  );
}
