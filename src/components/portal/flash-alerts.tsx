import { Alert } from "@/components/ui/alert";
import type { FlashInput } from "@/components/portal/flash";

/** Renders the `?message=` / `?error=` feedback left by a redirecting action. */
export function FlashAlerts({ flash, className }: { flash: FlashInput; className?: string }) {
  if (!flash.message && !flash.error) return null;
  return (
    <div className={className ?? "flex flex-col gap-3"}>
      {flash.message ? (
        <Alert kind="success" role="status">
          {flash.message}
        </Alert>
      ) : null}
      {flash.error ? (
        <Alert kind="danger" role="alert">
          {flash.error}
        </Alert>
      ) : null}
    </div>
  );
}
