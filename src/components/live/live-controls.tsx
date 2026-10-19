"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

type Act = () => Promise<ActionResult<undefined>>;

/** Re-reads the timeline every 30 seconds while the page is visible: delays reported by others show up without reloading. */
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function LiveButton({ act, label, done, variant = "outline", ariaLabel }: { act: Act; label: string; done: string; variant?: "default" | "outline"; ariaLabel?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={pending}
      aria-label={ariaLabel}
      onClick={() =>
        start(async () => {
          const res = await act();
          if (res.ok) {
            toast.success(done);
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      {label}
    </Button>
  );
}

/** Organisers: which step this one waits for. */
export function DependencySelect({ id, value, options, act }: { id: string; value: string; options: { id: string; title: string }[]; act: (dependsOnId: string) => Promise<ActionResult<undefined>> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      id={id}
      value={value}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(async () => {
          const res = await act(v);
          if (res.ok) router.refresh();
          else toast.error(res.error);
        });
      }}
      className="h-8 max-w-56 rounded-lg border bg-background px-2 text-sm"
    >
      <option value="">Ne dépend d'aucune étape</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          Après « {o.title} »
        </option>
      ))}
    </select>
  );
}
