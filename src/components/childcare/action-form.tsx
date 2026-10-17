"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/shared/form-message";
import type { ActionResult } from "@/lib/errors";

export type FormAction = (formData: FormData) => Promise<ActionResult<unknown>>;

/**
 * Generic form bound to a server action taking FormData. Handles pending
 * state, error display (global + per field), toast and refresh. Used by the
 * childcare, calendar and trade-tool screens to keep client code minimal.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Enregistrer",
  successMessage,
  resetOnSuccess = false,
  onSuccess,
  className,
  inline = false,
}: {
  action: FormAction;
  children: React.ReactNode | ((state: { fieldErrors: Record<string, string[]>; pending: boolean }) => React.ReactNode);
  submitLabel?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (data: unknown) => void;
  className?: string;
  inline?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  return (
    <form
      ref={ref}
      className={className ?? (inline ? "flex flex-wrap items-end gap-2" : "space-y-4")}
      action={(fd) => {
        setError(null);
        setFieldErrors({});
        start(async () => {
          const res = await action(fd);
          if (res.ok) {
            if (successMessage) toast.success(successMessage);
            if (resetOnSuccess) ref.current?.reset();
            onSuccess?.(res.data);
            router.refresh();
          } else {
            setError(res.error);
            setFieldErrors(res.fieldErrors ?? {});
          }
        });
      }}
    >
      {typeof children === "function" ? children({ fieldErrors, pending }) : children}
      <FormMessage error={error} />
      <Button type="submit" disabled={pending} aria-busy={pending} size={inline ? "sm" : "default"}>
        {pending ? "En cours…" : submitLabel}
      </Button>
    </form>
  );
}

/** Dialog wrapper around ActionForm: closes on success. */
export function ActionDialog({
  trigger,
  title,
  description,
  action,
  children,
  submitLabel,
  successMessage,
  wide = false,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: FormAction;
  children: React.ReactNode | ((state: { fieldErrors: Record<string, string[]>; pending: boolean }) => React.ReactNode);
  submitLabel?: string;
  successMessage?: string;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={wide ? "max-h-[90dvh] overflow-y-auto sm:max-w-2xl" : "max-h-[90dvh] overflow-y-auto sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ActionForm action={action} submitLabel={submitLabel} successMessage={successMessage} onSuccess={() => setOpen(false)}>
          {children}
        </ActionForm>
        <DialogFooter className="sr-only" />
      </DialogContent>
    </Dialog>
  );
}

/** Small inline button bound to a parameterless server action (check-in, mark informed…). */
export function ActionButton({
  action,
  children,
  successMessage,
  variant = "outline",
  size = "sm",
  className,
}: {
  action: () => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  successMessage?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          const res = await action();
          if (res.ok) {
            if (successMessage) toast.success(successMessage);
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      {children}
    </Button>
  );
}

/** Formats a Zod-style issue list for FieldError components. */
export function fieldError(fieldErrors: Record<string, string[]>, name: string): string | undefined {
  return fieldErrors[name]?.[0];
}
