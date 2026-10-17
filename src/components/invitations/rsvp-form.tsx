"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/shared/form-message";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { RsvpFormValues } from "@/app/(public)/invitation/[token]/actions";

type Guest = { id: string; firstName: string; lastName: string; isChild: boolean; plusOnesAllowed: number };

export function RsvpForm({ token, guests, previous, onSubmit }: { token: string; guests: Guest[]; previous: { status: string; guestsCount: number; message: string | null; perGuest: Record<string, "accepted" | "declined"> } | null; onSubmit: (token: string, values: RsvpFormValues) => Promise<ActionResult> }) {
  const router = useRouter();
  const [status, setStatus] = useState<"accepted" | "declined" | "maybe" | null>((previous?.status as "accepted" | "declined" | "maybe" | undefined) ?? null);
  const [perGuest, setPerGuest] = useState<Record<string, "accepted" | "declined">>(() => Object.fromEntries(guests.map((g) => [g.id, previous?.perGuest[g.id] ?? "accepted"])));
  const [companions, setCompanions] = useState(Math.max(0, (previous?.guestsCount ?? Math.max(1, guests.length)) - Math.max(1, guests.length)));
  const [message, setMessage] = useState(previous?.message ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const maxCompanions = guests.reduce((n, g) => n + g.plusOnesAllowed, 0);
  const acceptedGuests = guests.length === 0 ? 1 : Object.values(perGuest).filter((v) => v === "accepted").length;
  const total = status === "declined" ? 0 : acceptedGuests + Math.min(companions, maxCompanions);

  function submit() {
    if (!status) return setError("Choisissez une réponse.");
    setError(null);
    start(async () => {
      const res = await onSubmit(token, { status, guestsCount: total, message: message || null, perGuest: guests.length > 0 ? perGuest : undefined });
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-success/40 bg-success/10 p-6 text-center">
        <Check className="mx-auto mb-2 size-8 text-success" aria-hidden="true" />
        <p className="font-medium">Merci, votre réponse a bien été enregistrée.</p>
        <p className="mt-1 text-sm text-muted-foreground">Vous pouvez revenir sur ce lien pour la modifier.</p>
      </div>
    );
  }

  const choices: Array<{ value: "accepted" | "declined" | "maybe"; label: string; icon: typeof Check; tone: string }> = [
    { value: "accepted", label: "Je serai présent(e)", icon: Check, tone: "border-success bg-success/10 text-success" },
    { value: "maybe", label: "Peut-être", icon: HelpCircle, tone: "border-warning bg-warning/15 text-warning-foreground" },
    { value: "declined", label: "Je ne pourrai pas venir", icon: X, tone: "border-destructive bg-destructive/10 text-destructive" },
  ];

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Votre réponse</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {choices.map((c) => (
            <label key={c.value} className={cn("flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-medium transition-colors", status === c.value ? c.tone : "border-border hover:bg-muted")}>
              <input type="radio" name="status" value={c.value} className="sr-only" checked={status === c.value} onChange={() => setStatus(c.value)} />
              <c.icon className="size-4" aria-hidden="true" /> {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      {status && status !== "declined" && guests.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Qui sera présent ?</legend>
          <ul className="divide-y rounded-xl border">
            {guests.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>
                  {`${g.firstName} ${g.lastName}`.trim()}
                  {g.isChild && <span className="ml-1 text-xs text-muted-foreground">(enfant)</span>}
                </span>
                <div className="flex gap-1" role="radiogroup" aria-label={`Présence de ${g.firstName}`}>
                  {(["accepted", "declined"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={perGuest[g.id] === v}
                      onClick={() => setPerGuest((p) => ({ ...p, [g.id]: v }))}
                      className={cn("rounded-full border px-3 py-1 text-xs", perGuest[g.id] === v ? (v === "accepted" ? "border-success bg-success/15 text-success" : "border-destructive bg-destructive/10 text-destructive") : "hover:bg-muted")}
                    >
                      {v === "accepted" ? "Présent(e)" : "Absent(e)"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {status && status !== "declined" && maxCompanions > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="rsvp-companions">Accompagnant(s) supplémentaire(s) (max {maxCompanions})</Label>
          <input id="rsvp-companions" type="number" min={0} max={maxCompanions} value={companions} onChange={(e) => setCompanions(Math.max(0, Math.min(maxCompanions, Number(e.target.value) || 0)))} className="h-10 w-28 rounded-lg border border-input bg-transparent px-3 text-base" />
        </div>
      )}

      {status && status !== "declined" && <p className="text-sm text-muted-foreground">Total annoncé : {total} personne(s)</p>}

      <div className="space-y-1.5">
        <Label htmlFor="rsvp-message">Un petit mot pour l'organisateur (facultatif)</Label>
        <Textarea id="rsvp-message" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <FormMessage error={error} />
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending || !status}>
        {pending ? "Envoi…" : previous ? "Mettre à jour ma réponse" : "Envoyer ma réponse"}
      </Button>
    </form>
  );
}
