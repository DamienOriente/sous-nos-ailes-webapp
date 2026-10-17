"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/shared/form-message";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";

export type FormAction = (formData: FormData) => Promise<ActionResult<unknown>>;

/**
 * Thin client wrapper around a server action: submits the form data, shows the
 * error inline + toast, refreshes server components on success and follows an
 * optional `redirectTo` returned by the action.
 */
export function ActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      ref={formRef}
      className={cn("space-y-3", className)}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await action(data);
          if (!res.ok) {
            setError(res.error);
            toast.error(res.error);
            return;
          }
          if (successMessage) toast.success(successMessage);
          const redirectTo = typeof res.data === "object" && res.data !== null && "redirectTo" in res.data ? (res.data as { redirectTo?: string }).redirectTo : undefined;
          if (redirectTo) {
            if (/^https?:\/\//.test(redirectTo)) window.location.assign(redirectTo);
            else router.push(redirectTo);
            return;
          }
          if (resetOnSuccess) formRef.current?.reset();
          onSuccess?.();
          router.refresh();
        });
      }}
    >
      {children}
      <FormMessage error={error} />
    </form>
  );
}

/** Submit button aware of the surrounding ActionForm transition (uses aria-busy on the form). */
export function ActionSubmit({ children, pendingLabel, ...props }: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  return (
    <Button type="submit" {...props} className={cn("group-aria-busy:opacity-70", props.className)}>
      <Loader2 className="hidden size-4 animate-spin [form[aria-busy=true]_&]:inline" aria-hidden="true" />
      <span className="[form[aria-busy=true]_&]:hidden">{children}</span>
      {pendingLabel && <span className="hidden [form[aria-busy=true]_&]:inline">{pendingLabel}</span>}
    </Button>
  );
}
