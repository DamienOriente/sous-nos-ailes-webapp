"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/shared/form-message";
import type { ActionResult } from "@/lib/errors";
import { IDENTITY_CHECK_LABELS, IDENTITY_CHECK_METHODS, type IdentityCheckMethod } from "@/modules/childcare/domain/rules";

export type AuthorizedPersonOption = { id: string; name: string; relationship: string; phone: string | null; identityCheckHint: string | null; isPrimaryGuardian: boolean };

/**
 * Three-step handover: (1) authorised person from the list, (2) identity check
 * declared, (3) confirmation by the signed-in care team member. There is no
 * free-text recipient on purpose: adding a person is an organiser action.
 */
export function HandoverWizard({
  childName,
  persons,
  actorName,
  disabled,
  onConfirm,
}: {
  childName: string;
  persons: AuthorizedPersonOption[];
  actorName: string;
  disabled?: string | null;
  onConfirm: (fd: FormData) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [personId, setPersonId] = useState<string>("");
  const [method, setMethod] = useState<IdentityCheckMethod | "">("");
  const [details, setDetails] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const person = persons.find((p) => p.id === personId);

  function reset() {
    setStep(1);
    setPersonId("");
    setMethod("");
    setDetails("");
    setNote("");
    setError(null);
  }

  function confirm() {
    const fd = new FormData();
    fd.set("authorizedPersonId", personId);
    fd.set("identityCheckMethod", method);
    fd.set("identityCheckDetails", details);
    fd.set("note", note);
    start(async () => {
      const res = await onConfirm(fd);
      if (res.ok) {
        toast.success(`${childName} remis·e à ${person?.name ?? "la personne autorisée"}.`);
        setOpen(false);
        reset();
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={Boolean(disabled)} title={disabled ?? undefined}>
           Remettre l'enfant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Remise de {childName}</DialogTitle>
          <DialogDescription>Étape {step} sur 3. Aucune remise sans personne autorisée, vérification d'identité et confirmation d'un membre de l'équipe.</DialogDescription>
        </DialogHeader>
        <ol className="flex gap-2 text-xs" aria-label="Progression">
          {["Personne autorisée", "Identité vérifiée", "Confirmation"].map((label, i) => (
            <li key={label} className={`flex-1 rounded-full px-2 py-1 text-center ${step > i ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`} aria-current={step === i + 1 ? "step" : undefined}>
              {label}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className="space-y-3">
            {persons.length === 0 ? (
              <FormMessage error="Aucune personne autorisée n'est enregistrée pour cet enfant. Un organisateur doit en ajouter une avant toute remise." />
            ) : (
              <RadioGroup value={personId} onValueChange={setPersonId} aria-label="Personne autorisée">
                {persons.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-[state=checked]:border-primary">
                    <RadioGroupItem value={p.id} id={`p-${p.id}`} className="mt-0.5" />
                    <span className="flex-1 text-sm">
                      <span className="font-medium">{p.name}</span> <span className="text-muted-foreground">({p.relationship})</span>
                      {p.isPrimaryGuardian && <span className="ml-2 rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">responsable légal</span>}
                      {p.identityCheckHint && <span className="mt-1 block text-xs text-muted-foreground">Vérification attendue : {p.identityCheckHint}</span>}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
            <p className="text-xs text-muted-foreground">Une personne absente de la liste ne peut pas être choisie ici : demandez à un organisateur de l'ajouter.</p>
            <div className="flex justify-end">
              <Button type="button" disabled={!personId} onClick={() => setStep(2)}>
                Continuer
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as IdentityCheckMethod)} aria-label="Méthode de vérification">
              {IDENTITY_CHECK_METHODS.map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-data-[state=checked]:border-primary">
                  <RadioGroupItem value={m} id={`m-${m}`} />
                  <span className="text-sm">{IDENTITY_CHECK_LABELS[m]}</span>
                </label>
              ))}
            </RadioGroup>
            <div className="space-y-1.5">
              <Label htmlFor="identityCheckDetails">Précisions {method === "other" ? "*" : "(optionnel)"}</Label>
              <Input id="identityCheckDetails" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={300} placeholder="Ex. carte d'identité au nom de…" />
            </div>
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Retour
              </Button>
              <Button type="button" disabled={!method || (method === "other" && details.trim().length < 3)} onClick={() => setStep(3)}>
                Continuer
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <dl className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Remis à</dt>
                <dd className="font-medium">
                  {person?.name} ({person?.relationship})
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Identité</dt>
                <dd className="text-right">{method ? IDENTITY_CHECK_LABELS[method] : ""}{details ? ` : ${details}` : ""}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Confirmé par</dt>
                <dd className="font-medium">{actorName}</dd>
              </div>
            </dl>
            <div className="space-y-1.5">
              <Label htmlFor="handoverNote">Remarque (optionnel)</Label>
              <Textarea id="handoverNote" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
            </div>
            <FormMessage error={error} />
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={pending}>
                Retour
              </Button>
              <Button type="button" onClick={confirm} disabled={pending} aria-busy={pending}>
                 {pending ? "Enregistrement…" : "Confirmer la remise"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
