"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/lib/errors";

/**
 * Confirmation for destructive actions. `onConfirm` is a server action
 * returning an ActionResult; errors are surfaced as toasts.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmer",
  destructive = true,
  onConfirm,
  successMessage,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<ActionResult<unknown>>;
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await onConfirm();
                if (res.ok) {
                  if (successMessage) toast.success(successMessage);
                  setOpen(false);
                } else {
                  toast.error(res.error);
                }
              });
            }}
          >
            {pending ? "En cours…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
