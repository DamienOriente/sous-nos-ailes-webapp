"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormMessage } from "@/components/shared/form-message";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { BUSY_REASON_LABELS, type BusyReason } from "@/modules/directory/domain/availability";

export type SendTarget = {
  professionalId: string;
  displayName: string;
  categoryName: string;
  source: "shortlist" | "favorite";
  openInquiryStatus: string | null;
  available: boolean | null;
  reason: BusyReason | null;
};

const KINDS = [
  { value: "quote", label: "Demande de devis" },
  { value: "availability", label: "Disponibilité" },
  { value: "contact", label: "Prise de contact" },
] as const;

/** Picks providers from the shortlist and favourites, then sends them the same brief in one go. */
export function BriefSendForm({ targets, hasDate, action }: { targets: SendTarget[]; hasDate: boolean; action: (input: { professionalIds: string[]; kind: string; message: string }) => Promise<ActionResult<{ sent: number; skipped: number }>> }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<string>("quote");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await action({ professionalIds: [...selected], kind, message });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          toast.success(res.data.sent === 1 ? "Brief envoyé à 1 professionnel." : `Brief envoyé à ${res.data.sent} professionnels.`);
          setSelected(new Set());
          setMessage("");
          router.refresh();
        });
      }}
    >
      <fieldset>
        <legend className="text-sm font-medium">Destinataires</legend>
        <ul className="mt-2 divide-y rounded-xl border">
          {targets.map((t) => {
            const contacted = t.openInquiryStatus !== null;
            const id = `t-${t.professionalId}`;
            return (
              <li key={t.professionalId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <input id={id} type="checkbox" className="size-4" checked={selected.has(t.professionalId)} disabled={contacted || pending} onChange={() => toggle(t.professionalId)} />
                <Label htmlFor={id} className="min-w-0 flex-1 flex-col items-start gap-0 font-normal">
                  <span className="font-medium">{t.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.categoryName}, {t.source === "shortlist" ? "dans la liste de l'évènement" : "dans vos favoris"}
                  </span>
                </Label>
                {contacted ? (
                  <StatusBadge tone="neutral">Déjà contacté</StatusBadge>
                ) : hasDate && t.available !== null ? (
                  t.available ? (
                    <StatusBadge tone="success">{t.reason === "held_by_you" ? BUSY_REASON_LABELS.held_by_you : "Libre à la date"}</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">{t.reason ? BUSY_REASON_LABELS[t.reason] : "Occupé"}</StatusBadge>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      </fieldset>
      <fieldset className="flex flex-wrap gap-2" aria-label="Type de demande">
        {KINDS.map((k) => (
          <label key={k.value} className="cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary">
            <input type="radio" name="kind" value={k.value} className="sr-only" checked={kind === k.value} onChange={() => setKind(k.value)} />
            {k.label}
          </label>
        ))}
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="brief-message">Un mot en plus (facultatif)</Label>
        <Textarea id="brief-message" rows={3} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Par exemple : nous cherchons une proposition avant la fin du mois." />
      </div>
      <FormMessage error={error} />
      <Button type="submit" disabled={pending || selected.size === 0} aria-busy={pending}>
        {pending ? "Envoi…" : selected.size > 1 ? `Envoyer le brief à ${selected.size} professionnels` : "Envoyer le brief"}
      </Button>
    </form>
  );
}
