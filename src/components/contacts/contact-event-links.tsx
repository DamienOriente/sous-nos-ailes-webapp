"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/errors";

type Ev = { id: string; name: string; eventDate: string | null };

export function ContactEventLinks({ contactId, linked, linkable, onToggle }: { contactId: string; linked: Ev[]; linkable: Ev[]; onToggle: (contactId: string, eventId: string, link: boolean) => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState("");
  const options = linkable.filter((e) => !linked.some((l) => l.id === e.id));
  const toggle = (eventId: string, link: boolean) =>
    start(async () => {
      const res = await onToggle(contactId, eventId, link);
      if (res.ok) {
        toast.success(link ? "Contact associé à l'évènement." : "Association retirée.");
        setSelected("");
        router.refresh();
      } else toast.error(res.error);
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Évènements associés</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {linked.length === 0 && <p className="text-sm text-muted-foreground">Aucun évènement associé.</p>}
        <ul className="space-y-2">
          {linked.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <Link href={`/app/evenements/${e.id}`} className="truncate font-medium hover:underline">
                {e.name}
              </Link>
              <Button variant="ghost" size="icon-xs" aria-label={`Retirer de ${e.name}`} disabled={pending} onClick={() => toggle(e.id, false)}>
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        {options.length > 0 && (
          <div className="flex gap-2">
            <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Évènement à associer" className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm">
              <option value="">Choisir un évènement…</option>
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={!selected || pending} onClick={() => toggle(selected, true)}>
              <CalendarPlus className="size-4" aria-hidden="true" /> Associer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
