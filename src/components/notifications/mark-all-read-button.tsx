"use client";
import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

export function MarkAllReadButton({ action, disabled }: { action: () => Promise<ActionResult<{ count: number }>>; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const res = await action();
          if (res.ok) {
            toast.success(res.data.count > 0 ? `${res.data.count} notification${res.data.count > 1 ? "s" : ""} marquée${res.data.count > 1 ? "s" : ""} comme lue${res.data.count > 1 ? "s" : ""}.` : "Tout est déjà lu.");
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      <CheckCheck className="size-4" aria-hidden="true" />
      Tout marquer comme lu
    </Button>
  );
}
