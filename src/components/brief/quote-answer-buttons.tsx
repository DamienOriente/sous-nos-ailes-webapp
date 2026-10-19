"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

export function QuoteAnswerButtons({ name, accept, decline }: { name: string; accept: () => Promise<ActionResult<undefined>>; decline: () => Promise<ActionResult<undefined>> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<undefined>>, done: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(done);
        router.refresh();
      } else toast.error(res.error);
    });
  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" disabled={pending} onClick={() => run(accept, `Devis de ${name} accepté.`)} aria-label={`Accepter le devis de ${name}`}>
        Accepter
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(decline, `Devis de ${name} refusé.`)} aria-label={`Refuser le devis de ${name}`}>
        Refuser
      </Button>
    </div>
  );
}
