"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/shared/form-message";
import { InvitationCard, type InvitationCardData } from "@/components/invitations/invitation-card";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { INVITATION_KIND_LABELS, INVITATION_KINDS, type InvitationKind } from "@/modules/invitations/domain/state";
import { INVITATION_TEMPLATE_META, INVITATION_TEMPLATES } from "@/modules/invitations/domain/templates";
import type { InvitationFormValues } from "@/app/app/evenements/[id]/invitations/actions";

type Guest = { id: string; firstName: string; lastName: string; email: string | null; groupId: string | null; isChild: boolean };

export function InvitationForm({
  eventId,
  event,
  guests,
  groups,
  premium,
  initial,
  onSubmit,
}: {
  eventId: string;
  event: Omit<InvitationCardData, "templateKey" | "recipientName" | "customMessage" | "showDate" | "showVenue">;
  guests: Guest[];
  groups: Array<{ id: string; name: string }>;
  premium: boolean;
  initial?: Partial<InvitationFormValues> & { id?: string };
  onSubmit: (values: InvitationFormValues) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [kind, setKind] = useState<InvitationKind>(initial?.kind ?? "individual");
  const [templateKey, setTemplateKey] = useState(initial?.templateKey ?? "classic");
  const [recipientName, setRecipientName] = useState(initial?.recipientName ?? "");
  const [recipientEmail, setRecipientEmail] = useState(initial?.recipientEmail ?? "");
  const [customMessage, setCustomMessage] = useState(initial?.customMessage ?? "");
  const [showDate, setShowDate] = useState(initial?.showDate ?? true);
  const [showVenue, setShowVenue] = useState(initial?.showVenue ?? true);
  const [guestIds, setGuestIds] = useState<string[]>(initial?.guestIds ?? []);
  const [groupId, setGroupId] = useState(initial?.groupId ?? "");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filteredGuests = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? guests.filter((g) => `${g.firstName} ${g.lastName}`.toLowerCase().includes(t)) : guests;
  }, [guests, q]);

  function pickGuest(g: Guest) {
    if (kind === "individual") {
      setGuestIds([g.id]);
      if (!recipientName) setRecipientName(`${g.firstName} ${g.lastName}`.trim());
      if (!recipientEmail && g.email) setRecipientEmail(g.email);
      return;
    }
    setGuestIds((ids) => (ids.includes(g.id) ? ids.filter((i) => i !== g.id) : [...ids, g.id]));
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await onSubmit({ kind, templateKey, recipientName, recipientEmail: recipientEmail || null, customMessage: customMessage || null, guestIds: kind === "group" ? [] : guestIds, groupId: kind === "group" ? groupId : null, showDate, showVenue });
      if (res.ok) {
        toast.success(isEdit ? "Invitation mise à jour." : "Invitation créée.");
        router.push(`/app/evenements/${eventId}/invitations/${res.data.id}`);
        router.refresh();
      } else setError(res.error);
    });
  }

  const preview: InvitationCardData = { ...event, templateKey, recipientName: recipientName || "Prénom Nom", customMessage: customMessage || null, showDate, showVenue };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {!isEdit && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Type d'invitation</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {INVITATION_KINDS.map((k) => (
                <label key={k} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm", kind === k && "border-primary bg-primary/5")}>
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="accent-primary" />
                  {INVITATION_KIND_LABELS[k]}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Individuelle : un invité. Familiale : plusieurs invités répondent sur un seul lien. De groupe : tous les invités d'un groupe.</p>
          </fieldset>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Nom du destinataire *</Label>
            <Input id="inv-name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required placeholder="Famille Marchand" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">E-mail (pour l'envoi)</Label>
            <Input id="inv-email" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="Facultatif, sinon partagez le lien" />
          </div>
        </div>

        {!isEdit && kind !== "group" && (
          <div className="space-y-2">
            <Label>Invité(s) couvert(s) {kind === "individual" ? "(un seul)" : ""}</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un invité…" aria-label="Rechercher un invité" />
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
              {filteredGuests.length === 0 && <li className="p-2 text-sm text-muted-foreground">Aucun invité trouvé. Ajoutez-les d'abord dans la liste des invités.</li>}
              {filteredGuests.map((g) => (
                <li key={g.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    {kind === "individual" ? (
                      <input type="radio" name="guest" checked={guestIds[0] === g.id} onChange={() => pickGuest(g)} className="accent-primary" />
                    ) : (
                      <Checkbox checked={guestIds.includes(g.id)} onCheckedChange={() => pickGuest(g)} />
                    )}
                    <span>
                      {`${g.firstName} ${g.lastName}`.trim()}
                      {g.isChild && <span className="ml-1 text-xs text-muted-foreground">(enfant)</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{guestIds.length} sélectionné(s)</p>
          </div>
        )}
        {!isEdit && kind === "group" && (
          <div className="space-y-1.5">
            <Label htmlFor="inv-group">Groupe *</Label>
            <select id="inv-group" value={groupId} onChange={(e) => setGroupId(e.target.value)} required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
              <option value="">Choisir…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Modèle</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {INVITATION_TEMPLATES.map((t) => {
              const meta = INVITATION_TEMPLATE_META[t];
              const locked = meta.premium && !premium;
              return (
                <label key={t} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm", templateKey === t && "border-primary bg-primary/5", locked && "cursor-not-allowed opacity-60")}>
                  <input type="radio" name="template" value={t} disabled={locked} checked={templateKey === t} onChange={() => setTemplateKey(t)} className="mt-1 accent-primary" />
                  <span>
                    <span className="flex items-center gap-1 font-medium">
                      {meta.label} {locked && <span className="text-xs font-normal text-muted-foreground">(offre Plus)</span>}
                    </span>
                    <span className="block text-xs text-muted-foreground">{meta.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {!premium && (
            <p className="text-xs text-muted-foreground">
              Modèles champêtre, moderne et enfantin : inclus dans{" "}
              <Link href="/app/compte/abonnement?audience=organizer&feature=invitations.premium" className="font-medium text-primary underline-offset-2 hover:underline">
                Organisateur Plus
              </Link>
              .
            </p>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="inv-message">Message personnalisé</Label>
          <Textarea id="inv-message" rows={4} value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} maxLength={premium ? 2000 : 500} placeholder="Nous serions heureux de vous compter parmi nous…" />
          <p className="text-xs text-muted-foreground">
            {customMessage.length}/{premium ? 2000 : 500}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={showDate} onCheckedChange={(v) => setShowDate(v === true)} /> Afficher la date
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={showVenue} onCheckedChange={(v) => setShowVenue(v === true)} /> Afficher le lieu
          </label>
        </div>
        <FormMessage error={error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer l'invitation"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href={`/app/evenements/${eventId}/invitations`}>Annuler</Link>
          </Button>
        </div>
      </form>
      <aside aria-label="Aperçu de l'invitation" className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Aperçu</p>
        <InvitationCard data={preview} />
      </aside>
    </div>
  );
}
