import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accessible inline form feedback (global error or success). */
export function FormMessage({ error, success, className }: { error?: string | null; success?: string | null; className?: string }) {
  if (!error && !success) return null;
  const isError = Boolean(error);
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-sm", isError ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success", className)}
    >
      {isError ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      <span>{error ?? success}</span>
    </p>
  );
}
