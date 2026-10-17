"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormMessage } from "@/components/shared/form-message";
import type { ActionResult } from "@/lib/errors";
import { CONTACT_CATEGORIES, CONTACT_CATEGORY_LABELS } from "@/modules/contacts/domain/contact-import";
import type { ContactFormValues } from "@/app/app/contacts/actions";

export type ContactFormInitial = Partial<ContactFormValues> & { id?: string };

/**
 * Create/edit dialog. `scopes` lists where a new contact can be stored
 * (personal + organisations the user administers).
 */
export function ContactFormDialog({
  trigger,
  initial,
  scopes,
  onSubmit,
  disabledReason,
}: {
  trigger: React.ReactNode;
  initial?: ContactFormInitial;
  scopes?: Array<{ value: string; label: string }>;
  onSubmit: (values: ContactFormValues & { scope: string }) => Promise<ActionResult<{ id: string }>>;
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const [category, setCategory] = useState<string>(initial?.category ?? "");
  const [scope, setScope] = useState<string>(scopes?.[0]?.value ?? "personal");
  const isEdit = Boolean(initial?.id);

  function submit(formData: FormData) {
    setError(null);
    const values: ContactFormValues & { scope: string } = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      company: String(formData.get("company") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      category: (category || null) as ContactFormValues["category"],
      tags: String(formData.get("tags") ?? ""),
      notes: String(formData.get("notes") ?? "") || null,
      scope,
    };
    start(async () => {
      const res = await onSubmit(values);
      if (res.ok) {
        toast.success(isEdit ? "Contact mis à jour." : "Contact ajouté.");
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le contact" : "Nouveau contact"}</DialogTitle>
          <DialogDescription>Les coordonnées restent privées : visibles uniquement par vous (ou votre organisation).</DialogDescription>
        </DialogHeader>
        {disabledReason ? (
          <FormMessage error={disabledReason} />
        ) : (
          <form action={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cf-firstName">Prénom</Label>
                <Input id="cf-firstName" name="firstName" defaultValue={initial?.firstName ?? ""} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-lastName">Nom</Label>
                <Input id="cf-lastName" name="lastName" defaultValue={initial?.lastName ?? ""} autoComplete="off" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-company">Société / structure</Label>
              <Input id="cf-company" name="company" defaultValue={initial?.company ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cf-email">E-mail</Label>
                <Input id="cf-email" name="email" type="email" inputMode="email" defaultValue={initial?.email ?? ""} aria-invalid={Boolean(fieldErrors.email)} />
                {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-phone">Téléphone</Label>
                <Input id="cf-phone" name="phone" type="tel" inputMode="tel" placeholder="06 12 34 56 78" defaultValue={initial?.phone ?? ""} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cf-category">Catégorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="cf-category" className="w-full">
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CONTACT_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-tags">Tags (séparés par des virgules)</Label>
                <Input id="cf-tags" name="tags" placeholder="mariage, traiteur" defaultValue={initial?.tags ?? ""} />
              </div>
            </div>
            {!isEdit && scopes && scopes.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-scope">Carnet</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger id="cf-scope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scopes.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cf-notes">Notes</Label>
              <Textarea id="cf-notes" name="notes" rows={3} defaultValue={initial?.notes ?? ""} />
            </div>
            <FormMessage error={error} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
