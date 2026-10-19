"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";

type Run = () => Promise<ActionResult<undefined>>;

/** Small action button with toast feedback (confirm / release an option). */
export function HoldActionButton({ run, label, done, variant = "outline" }: { run: Run; label: string; done: string; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await run();
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

export type HoldEventOption = { id: string; name: string; eventDate: string | null };

/**
 * "Poser une option 48 h" on a public page: pick one of your events (its date is used) or a
 * date, then the professional's day is reserved for you for 48 hours.
 */
export function PlaceHoldForm({
  professionalId,
  professionalName,
  events,
  defaultDate,
  action,
}: {
  professionalId: string;
  professionalName: string;
  events: HoldEventOption[];
  defaultDate?: string | null;
  action: (input: { professionalId: string; date: string; eventId?: string | null }) => Promise<ActionResult<{ expiresAt: string }>>;
}) {
  const withDate = events.filter((e) => e.eventDate);
  const [eventId, setEventId] = useState<string>(withDate[0]?.id ?? "");
  const [date, setDate] = useState<string>(defaultDate ?? withDate[0]?.eventDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (placed) {
    return (
      <div role="status" className="rounded-xl bg-success/10 p-4 text-sm" data-testid="hold-placed">
        <p className="font-medium">Option posée chez {professionalName}</p>
        <p className="text-muted-foreground">La date vous est réservée jusqu'au {placed}. Le professionnel est prévenu et vous répond pour confirmer.</p>
      </div>
    );
  }
  return (
    <form
      className="space-y-3"
      data-testid="hold-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await action({ professionalId, date, eventId: eventId || null });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setPlaced(new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(res.data.expiresAt)));
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {withDate.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="hold-event">Pour l'évènement</Label>
            <select
              id="hold-event"
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                const ev = withDate.find((x) => x.id === e.target.value);
                if (ev?.eventDate) setDate(ev.eventDate);
              }}
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
            >
              {withDate.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
              <option value="">Autre date</option>
            </select>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="hold-date">Date</Label>
          <Input id="hold-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <FormMessage error={error} />
      <Button type="submit" disabled={pending || !date} aria-busy={pending}>
        {pending ? "Un instant…" : "Poser une option de 48 h"}
      </Button>
    </form>
  );
}
