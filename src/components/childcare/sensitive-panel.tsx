"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormMessage } from "@/components/shared/form-message";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ActionResult } from "@/lib/errors";
import type { SensitiveReadResult } from "@/modules/childcare/application/children-service";
import { ActionDialog } from "./action-form";

export type SensitiveSummary = { hasAllergies: boolean; hasHealthNotes: boolean; consentActive: boolean; consentGivenByName: string | null; consentGivenAt: Date | null; consentWithdrawnAt: Date | null };

/**
 * Health data panel. Reading requires a purpose and is logged server side;
 * the decrypted text only lives in component state while the panel is open.
 */
export function SensitivePanel({
  summary,
  canView,
  canManage,
  onRead,
  onSet,
  onWithdraw,
}: {
  summary: SensitiveSummary;
  canView: boolean;
  canManage: boolean;
  onRead: (fd: FormData) => Promise<ActionResult<SensitiveReadResult>>;
  onSet: (fd: FormData) => Promise<ActionResult<unknown>>;
  onWithdraw: () => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const [revealed, setRevealed] = useState<SensitiveReadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const hasData = summary.hasAllergies || summary.hasHealthNotes;

  return (
    <section className="space-y-4 rounded-2xl border border-warning/40 bg-warning/5 p-4 sm:p-5" aria-labelledby="sensitive-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="sensitive-title" className="flex items-center gap-2 text-base font-semibold">
            <ShieldAlert className="size-4 text-warning-foreground" aria-hidden="true" /> Informations de santé
          </h2>
          <p className="text-sm text-muted-foreground">Chiffrées. Consultables uniquement avec un consentement actif, un motif, et chaque lecture est journalisée.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={summary.hasAllergies ? "warning" : "neutral"}>{summary.hasAllergies ? "Allergies renseignées" : "Pas d'allergie signalée"}</StatusBadge>
          <StatusBadge tone={summary.hasHealthNotes ? "warning" : "neutral"}>{summary.hasHealthNotes ? "Notes de santé" : "Pas de note de santé"}</StatusBadge>
          <StatusBadge tone={summary.consentActive ? "success" : "danger"}>{summary.consentActive ? "Consentement actif" : "Pas de consentement"}</StatusBadge>
        </div>
      </div>

      {summary.consentActive && summary.consentGivenByName && (
        <p className="text-xs text-muted-foreground">
          Consentement donné par <strong>{summary.consentGivenByName}</strong>
          {summary.consentGivenAt ? ` le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(summary.consentGivenAt)}` : ""}.
        </p>
      )}

      {canView && hasData && summary.consentActive && !revealed && (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          action={(fd) => {
            setError(null);
            start(async () => {
              const res = await onRead(fd);
              if (res.ok) {
                setRevealed(res.data);
                router.refresh();
              } else setError(res.error);
            });
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="purpose">Motif de la consultation *</Label>
            <Input id="purpose" name="purpose" required minLength={3} maxLength={200} placeholder="Ex. préparation du goûter, incident, remise" />
          </div>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            <Eye className="size-4" aria-hidden="true" /> {pending ? "Déchiffrement…" : "Consulter"}
          </Button>
        </form>
      )}
      <FormMessage error={error} />

      {revealed && (
        <div className="space-y-3 rounded-xl border bg-card p-4" role="region" aria-label="Informations de santé déchiffrées">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-medium">Allergies</dt>
              <dd className="whitespace-pre-wrap text-muted-foreground">{revealed.allergies ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium">Notes de santé</dt>
              <dd className="whitespace-pre-wrap text-muted-foreground">{revealed.healthNotes ?? "—"}</dd>
            </div>
          </dl>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRevealed(null)}>
            <EyeOff className="size-4" aria-hidden="true" /> Masquer
          </Button>
        </div>
      )}

      {canView && hasData && !summary.consentActive && <p className="text-sm text-destructive">Aucun consentement actif : ces informations ne peuvent pas être consultées.</p>}
      {canView && !hasData && <p className="text-sm text-muted-foreground">Aucune information de santé enregistrée pour cet enfant.</p>}
      {!canView && <p className="text-sm text-muted-foreground">Vous n'êtes pas habilité à consulter ces informations ; l'équipe de garde affectée l'est.</p>}

      {canManage && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <ActionDialog
            trigger={
              <Button variant="outline" size="sm">
                <ShieldCheck className="size-4" aria-hidden="true" /> {hasData ? "Mettre à jour" : "Renseigner"} avec consentement
              </Button>
            }
            title="Informations de santé"
            description="Saisissez uniquement ce qui est utile à la garde. Le responsable légal doit avoir donné son accord explicite ; vous l'enregistrez en son nom."
            action={onSet}
            submitLabel="Enregistrer avec consentement"
            successMessage="Informations enregistrées et chiffrées."
          >
            <div className="space-y-1.5">
              <Label htmlFor="allergies">Allergies et conduite à tenir</Label>
              <Textarea id="allergies" name="allergies" rows={3} maxLength={4000} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="healthNotes">Notes de santé utiles (traitement, précautions)</Label>
              <Textarea id="healthNotes" name="healthNotes" rows={3} maxLength={4000} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consentGivenByName">Nom du responsable légal ayant donné son accord *</Label>
              <Input id="consentGivenByName" name="consentGivenByName" required minLength={2} maxLength={120} />
            </div>
            <label className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
              <Checkbox name="consentConfirmed" required className="mt-0.5" />
              <span>
                Je confirme que le responsable légal a donné son <strong>consentement explicite</strong> au traitement de ces informations de santé, pour la seule prise en charge de l'enfant pendant l'évènement, et qu'il a été informé de ses droits (accès, rectification, retrait).
              </span>
            </label>
          </ActionDialog>
          {summary.consentActive && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="text-destructive">
                  Retirer le consentement
                </Button>
              }
              title="Retirer le consentement"
              description="Les allergies et notes de santé seront définitivement effacées. Le journal d'accès est conservé."
              confirmLabel="Retirer et effacer"
              onConfirm={async () => {
                const res = await onWithdraw();
                if (res.ok) {
                  toast.success("Consentement retiré, données effacées.");
                  router.refresh();
                }
                return res;
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}
