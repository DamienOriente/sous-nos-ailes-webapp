"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/shared/form-message";
import type { ActionResult } from "@/lib/errors";
import { DIETARY_SUGGESTIONS, RSVP_LABELS, RSVP_STATUSES } from "@/modules/guests/domain/guests";
import type { GuestFormValues } from "@/app/app/evenements/[id]/invites/actions";

export type GuestFormInitial = Partial<GuestFormValues> & { id?: string };

export function GuestFormDialog({
  trigger,
  eventId,
  groups,
  initial,
  onSubmit,
}: {
  trigger: React.ReactNode;
  eventId: string;
  groups: Array<{ id: string; name: string }>;
  initial?: GuestFormInitial;
  onSubmit: (values: GuestFormValues) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [isChild, setIsChild] = useState(Boolean(initial?.isChild));
  const isEdit = Boolean(initial?.id);

  function submit(fd: FormData) {
    setError(null);
    const values: GuestFormValues = {
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      email: String(fd.get("email") ?? "") || null,
      phone: String(fd.get("phone") ?? "") || null,
      groupId: String(fd.get("groupId") ?? "") || null,
      isChild,
      ageYears: isChild && fd.get("ageYears") ? Number(fd.get("ageYears")) : null,
      dietaryPreference: String(fd.get("dietaryPreference") ?? "") || null,
      plusOnesAllowed: Number(fd.get("plusOnesAllowed") ?? 0),
      notes: String(fd.get("notes") ?? "") || null,
      rsvpStatus: isEdit ? (String(fd.get("rsvpStatus")) as GuestFormValues["rsvpStatus"]) : undefined,
    };
    start(async () => {
      const res = await onSubmit(values);
      if (res.ok) {
        toast.success(isEdit ? "Invité mis à jour." : "Invité ajouté.");
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'invité" : "Ajouter un invité"}</DialogTitle>
          <DialogDescription>La préférence alimentaire est un simple libellé de régime (végétarien, sans porc…). Aucune information médicale ici.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gf-firstName">Prénom *</Label>
              <Input id="gf-firstName" name="firstName" required defaultValue={initial?.firstName ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gf-lastName">Nom</Label>
              <Input id="gf-lastName" name="lastName" defaultValue={initial?.lastName ?? ""} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gf-email">E-mail</Label>
              <Input id="gf-email" name="email" type="email" defaultValue={initial?.email ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gf-phone">Téléphone</Label>
              <Input id="gf-phone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gf-group">Groupe</Label>
              <select id="gf-group" name="groupId" defaultValue={initial?.groupId ?? ""} className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="">Aucun</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gf-plus">Accompagnants autorisés</Label>
              <Input id="gf-plus" name="plusOnesAllowed" type="number" min={0} max={10} defaultValue={initial?.plusOnesAllowed ?? 0} />
            </div>
          </div>
          <div className="space-y-2 rounded-xl border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={isChild} onCheckedChange={(v) => setIsChild(v === true)} name="isChild" />
               Cet invité est un enfant
            </label>
            {isChild && (
              <div className="grid gap-4 sm:grid-cols-[120px_1fr] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="gf-age">Âge (ans)</Label>
                  <Input id="gf-age" name="ageYears" type="number" min={0} max={17} defaultValue={initial?.ageYears ?? ""} />
                </div>
                {isEdit && initial?.id && (
                  <p className="text-xs text-muted-foreground">
                    Pour la garde et les consignes des parents :{" "}
                    <Link href={`/app/evenements/${eventId}/enfants/nouveau?guestId=${initial.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                      inscrire dans l'espace enfants
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gf-diet">Préférence alimentaire (libellé de régime)</Label>
            <Input id="gf-diet" name="dietaryPreference" list="gf-diet-list" defaultValue={initial?.dietaryPreference ?? ""} placeholder="Végétarien, sans porc…" />
            <datalist id="gf-diet-list">
              {DIETARY_SUGGESTIONS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="gf-rsvp">Réponse (RSVP)</Label>
              <select id="gf-rsvp" name="rsvpStatus" defaultValue={initial?.rsvpStatus ?? "pending"} className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                {RSVP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {RSVP_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="gf-notes">Notes</Label>
            <Textarea id="gf-notes" name="notes" rows={2} defaultValue={initial?.notes ?? ""} />
          </div>
          <FormMessage error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
