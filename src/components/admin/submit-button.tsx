"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Button>, "type" | "children"> & { label: string; pendingLabel?: string };

/** Submit button aware of the surrounding form's pending state. */
export function SubmitButton({ label, pendingLabel = "Enregistrement…", disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
