"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FileUpload } from "@/components/files/file-upload";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { EVENT_ROLE_LABELS } from "@/modules/authorization/domain/permissions";
import { privateFileHref } from "@/modules/files/application/file-urls";
import type { CategoryOption } from "@/modules/events/application/categories";
import { ASSIGNABLE_ROLES, PROVIDER_STATUS_LABELS, PROVIDER_TRANSITIONS, type ProviderStatus } from "@/modules/events/domain/providers";

export function ExternalProviderDialog({ eventId, categories, action, defaultCategory }: { eventId: string; categories: CategoryOption[]; action: (eventId: string, input: unknown) => Promise<ActionResult<{ id: string }>>; defaultCategory?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(defaultCategory ?? categories[0]?.slug ?? "");
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = { externalName: fd.get("externalName"), externalEmail: String(fd.get("externalEmail") ?? "") || null, externalPhone: String(fd.get("externalPhone") ?? "") || null, categorySlug: category, notes: String(fd.get("notes") ?? "") || null };
    start(async () => {
      const res = await action(eventId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Prestataire ajouté.");
      setOpen(false);
      router.push(`/app/evenements/${eventId}/prestataires/${res.data.id}`);
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" />
          Prestataire externe
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un prestataire externe</DialogTitle>
          <DialogDescription>Un professionnel qui n'est pas (encore) sur Sous Nos Ailes. Ses coordonnées restent privées, visibles des organisateurs seulement.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Nom ou raison sociale</Label>
            <Input id="ep-name" name="externalName" required minLength={2} maxLength={160} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-cat">Catégorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="ep-cat">
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ep-email">E-mail</Label>
              <Input id="ep-email" name="externalEmail" type="email" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-phone">Téléphone</Label>
              <Input id="ep-phone" name="externalPhone" type="tel" autoComplete="off" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-notes">Notes internes</Label>
            <Textarea id="ep-notes" name="notes" rows={2} maxLength={2000} />
          </div>
          <FormMessage error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Ajout…" : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InviteDialog({ eventId, eventProfessionalId, defaultEmail, defaultName, defaultRole = "provider", categorySlug, categories, action, triggerLabel = "Inviter par lien sécurisé" }: { eventId: string; eventProfessionalId?: string | null; defaultEmail?: string | null; defaultName?: string | null; defaultRole?: (typeof ASSIGNABLE_ROLES)[number]; categorySlug?: string | null; categories: CategoryOption[]; action: (eventId: string, input: unknown) => Promise<ActionResult<{ invitationId: string; expiresAt: string }>>; triggerLabel?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>(defaultRole);
  const [cat, setCat] = useState<string>(categorySlug ?? "none");
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = { email: fd.get("email"), name: fd.get("name"), role, categorySlug: cat === "none" ? null : cat, message: String(fd.get("message") ?? "") || null, eventProfessionalId: eventProfessionalId ?? null };
    start(async () => {
      const res = await action(eventId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Invitation envoyée par e-mail. Le lien est valable 14 jours.");
      setOpen(false);
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Mail className="size-4" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter dans l'équipe</DialogTitle>
          <DialogDescription>Un lien personnel et sécurisé est envoyé par e-mail. La personne devra se connecter (ou créer un compte) pour l'accepter.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Nom</Label>
              <Input id="inv-name" name="name" defaultValue={defaultName ?? ""} required minLength={2} maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">E-mail</Label>
              <Input id="inv-email" name="email" type="email" defaultValue={defaultEmail ?? ""} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-role">Rôle dans l'évènement</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="inv-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {EVENT_ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-cat">Métier (pour les outils dédiés)</Label>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger id="inv-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-message">Message (optionnel)</Label>
            <Textarea id="inv-message" name="message" rows={3} maxLength={1500} placeholder="Quelques mots pour présenter l'évènement…" />
          </div>
          <FormMessage error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Envoi…" : "Envoyer l'invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProviderStatusActions({ eventId, providerId, status, action }: { eventId: string; providerId: string; status: ProviderStatus; action: (eventId: string, providerId: string, to: ProviderStatus) => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = PROVIDER_TRANSITIONS[status];
  if (next.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {next.map((to) => (
        <Button
          key={to}
          size="sm"
          variant={to === "confirmed" ? "default" : to === "cancelled" || to === "declined" ? "destructive" : "outline"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await action(eventId, providerId, to);
              if (!res.ok) toast.error(res.error);
              else {
                toast.success(`Statut : ${PROVIDER_STATUS_LABELS[to]}.`);
                router.refresh();
              }
            })
          }
        >
          {to === "confirmed" ? "Confirmer" : to === "requested" ? "Marquer « demande envoyée »" : to === "quoted" ? "Devis reçu" : to === "declined" ? "Décliné" : to === "cancelled" ? "Annuler la prestation" : "Replacer en présélection"}
        </Button>
      ))}
    </div>
  );
}

export type ProviderDetailsValue = {
  externalName: string | null;
  externalEmail: string | null;
  externalPhone: string | null;
  isExternal: boolean;
  categorySlug: string | null;
  notes: string | null;
  quoteCents: number | null;
  quoteFileId: string | null;
  contractFileId: string | null;
  serviceDate: string | null;
  serviceStart: string | null;
  serviceEnd: string | null;
  budgetLineId: string | null;
};

export function ProviderDetailsForm({ eventId, providerId, value, categories, budgetLines, action }: { eventId: string; providerId: string; value: ProviderDetailsValue; categories: CategoryOption[]; budgetLines: Array<{ id: string; label: string }>; action: (eventId: string, providerId: string, input: unknown) => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState(value.categorySlug ?? "none");
  const [line, setLine] = useState(value.budgetLineId ?? "none");
  const [quoteFileId, setQuoteFileId] = useState<string | null>(value.quoteFileId);
  const [contractFileId, setContractFileId] = useState<string | null>(value.contractFileId);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const quote = String(fd.get("quote") ?? "").trim();
    const input = {
      externalName: value.isExternal ? String(fd.get("externalName") ?? "") || null : undefined,
      externalEmail: String(fd.get("externalEmail") ?? "") || null,
      externalPhone: String(fd.get("externalPhone") ?? "") || null,
      categorySlug: cat === "none" ? null : cat,
      notes: String(fd.get("notes") ?? "") || null,
      quoteCents: quote === "" ? null : Math.round(Number.parseFloat(quote.replace(",", ".")) * 100),
      quoteFileId,
      contractFileId,
      serviceDate: String(fd.get("serviceDate") ?? "") || null,
      serviceStart: String(fd.get("serviceStart") ?? "") || null,
      serviceEnd: String(fd.get("serviceEnd") ?? "") || null,
      budgetLineId: line === "none" ? null : line,
    };
    start(async () => {
      const res = await action(eventId, providerId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      toast.success("Fiche mise à jour.");
      router.refresh();
    });
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {value.isExternal && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pd-name">Nom</Label>
            <Input id="pd-name" name="externalName" defaultValue={value.externalName ?? ""} minLength={2} maxLength={160} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="pd-email">E-mail de contact</Label>
          <Input id="pd-email" name="externalEmail" type="email" defaultValue={value.externalEmail ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pd-phone">Téléphone</Label>
          <Input id="pd-phone" name="externalPhone" type="tel" defaultValue={value.externalPhone ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pd-cat">Catégorie</Label>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger id="pd-cat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Non précisée</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pd-quote">Devis (€ TTC)</Label>
          <Input id="pd-quote" name="quote" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={value.quoteCents !== null ? (value.quoteCents / 100).toString() : ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pd-line">Ligne de budget liée</Label>
          <Select value={line} onValueChange={setLine}>
            <SelectTrigger id="pd-line">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune</SelectItem>
              {budgetLines.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pd-date">Date de prestation</Label>
          <Input id="pd-date" name="serviceDate" type="date" defaultValue={value.serviceDate ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="pd-start">Début</Label>
            <Input id="pd-start" name="serviceStart" type="time" defaultValue={value.serviceStart ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pd-end">Fin</Label>
            <Input id="pd-end" name="serviceEnd" type="time" defaultValue={value.serviceEnd ?? ""} />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FileSlot label="Devis (PDF)" eventId={eventId} purpose="quote" fileId={quoteFileId} onChange={setQuoteFileId} />
        <FileSlot label="Contrat (PDF)" eventId={eventId} purpose="contract" fileId={contractFileId} onChange={setContractFileId} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pd-notes">Notes internes (organisateurs)</Label>
        <Textarea id="pd-notes" name="notes" rows={3} maxLength={2000} defaultValue={value.notes ?? ""} />
      </div>
      <FormMessage error={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

function FileSlot({ label, eventId, purpose, fileId, onChange }: { label: string; eventId: string; purpose: "quote" | "contract"; fileId: string | null; onChange: (id: string | null) => void }) {
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className="text-sm font-medium">{label}</p>
      {fileId ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <a href={privateFileHref(fileId)} className="inline-flex items-center gap-1.5 text-primary hover:underline" target="_blank" rel="noreferrer">
            <FileText className="size-4" aria-hidden="true" />
            Ouvrir le fichier
          </a>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(null)} aria-label={`Retirer le fichier (${label})`}>
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <FileUpload scope="event" scopeId={eventId} purpose={purpose} accept="application/pdf,image/*" maxFiles={1} onUploaded={(f) => onChange(f.id)} />
      )}
    </div>
  );
}

export function DeleteProviderButton({ eventId, providerId, label, action }: { eventId: string; providerId: string; label: string; action: (eventId: string, providerId: string) => Promise<ActionResult> }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" aria-hidden="true" />
          Retirer de la liste
        </Button>
      }
      title={`Retirer « ${label} » ?`}
      description="La fiche interne et les liens avec le budget seront supprimés. Un prestataire ayant rejoint l'équipe doit d'abord être révoqué."
      confirmLabel="Retirer"
      onConfirm={async () => {
        const res = await action(eventId, providerId);
        if (res.ok) router.push(`/app/evenements/${eventId}/prestataires`);
        return res;
      }}
    />
  );
}

export function RevokeAccessButton({ eventId, memberId, action }: { eventId: string; memberId: string; action: (eventId: string, memberId: string) => Promise<ActionResult> }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          Révoquer l'accès
        </Button>
      }
      title="Révoquer l'accès à l'évènement ?"
      description="La personne ne verra plus l'espace, les messages ni les documents. L'action est journalisée et immédiate."
      confirmLabel="Révoquer"
      successMessage="Accès révoqué."
      onConfirm={async () => {
        const res = await action(eventId, memberId);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
