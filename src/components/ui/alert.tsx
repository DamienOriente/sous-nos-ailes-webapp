import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Kind = "info" | "success" | "warning" | "danger" | "demo";

const styles: Record<Kind, string> = {
  info: "border-info-600/30 bg-info-100 text-info-600",
  success: "border-sage-300 bg-sage-50 text-sage-800",
  warning: "border-warning-600/30 bg-warning-100 text-warning-600",
  danger: "border-danger-600/30 bg-danger-100 text-danger-600",
  demo: "border-clay-300 bg-clay-100 text-clay-800",
};

export function Alert({ kind = "info", title, children, className, role }: { kind?: Kind; title?: ReactNode; children?: ReactNode; className?: string; role?: "alert" | "status" }) {
  return (
    <div role={role} className={cn("rounded-md border px-4 py-3 text-[15px] leading-snug", styles[kind], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title ? "mt-1" : "", "text-current/90")}>{children}</div> : null}
    </div>
  );
}
