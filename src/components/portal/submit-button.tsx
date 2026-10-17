"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = Omit<ComponentProps<typeof Button>, "type" | "children"> & { children: ReactNode; pendingLabel?: string };

/** Submit button aware of the enclosing form's pending state. */
export function SubmitButton({ children, pendingLabel = "Envoi…", disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
