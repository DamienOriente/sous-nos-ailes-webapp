"use client";
import { createContext, startTransition, useActionState, useContext, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/shared/form-message";
import type { ActionResult } from "@/lib/errors";

export type FormState = ActionResult<unknown> | null;
export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

const FieldErrorsContext = createContext<Record<string, string[]>>({});

/**
 * Generic server-action form: renders fields passed as children (server or
 * client), exposes per-field errors through context (see FieldErrorText),
 * shows the global error and toasts on success. The action may `redirect()`.
 *
 * Submission goes through `startTransition(formAction)` instead of the native
 * action path on purpose: React 19 resets uncontrolled fields after a native
 * form action completes, which would wipe the user's input on a validation error.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Enregistrer",
  pendingLabel = "Enregistrement…",
  successMessage,
  className,
  footer,
  id,
  variant,
  hideSubmit = false,
}: {
  action: FormAction;
  children: React.ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  successMessage?: string;
  className?: string;
  footer?: React.ReactNode;
  id?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  hideSubmit?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  useEffect(() => {
    if (state?.ok && successMessage) toast.success(successMessage);
  }, [state, successMessage]);
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <FieldErrorsContext.Provider value={fieldErrors}>
      <form
        action={formAction}
        className={className}
        id={id}
        noValidate
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter;
          const data = new FormData(e.currentTarget, submitter instanceof HTMLElement ? submitter : undefined);
          startTransition(() => formAction(data));
        }}
      >
        <fieldset disabled={pending} className="contents">
          {children}
        </fieldset>
        {state && !state.ok && <FormMessage error={state.error} className="mt-4" />}
        {state?.ok && successMessage && <FormMessage success={successMessage} className="mt-4" />}
        {!hideSubmit && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {footer ?? <span />}
            <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {pending ? pendingLabel : submitLabel}
            </Button>
          </div>
        )}
      </form>
    </FieldErrorsContext.Provider>
  );
}

/** Inline field error, reads the enclosing ActionForm state. Usable inside server-rendered children. */
export function FieldErrorText({ name }: { name: string }) {
  const errors = useContext(FieldErrorsContext);
  const msg = errors[name]?.[0];
  if (!msg) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {msg}
    </p>
  );
}
