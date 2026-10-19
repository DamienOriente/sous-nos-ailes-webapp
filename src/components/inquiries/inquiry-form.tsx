"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/shared/form-message";
import { EVENT_TYPE_OPTIONS } from "@/modules/professionals/domain/listing-schema";
import { INQUIRY_KIND_LABELS, type InquiryKind } from "@/modules/inquiries/domain/inquiry-status";

export type InquiryFormProps = {
  professionalId: string;
  professionalName: string;
  defaultKind?: InquiryKind;
  /** Pre-fills name/e-mail for a signed-in requester. */
  requester?: { name: string; email: string } | null;
  /** Event the organiser is contacting from (`?event=`); kept server side only if they organise it. */
  eventId?: string | null;
  /** Signed-in organiser's events: picking one attaches its brief instead of retyping the details. */
  events?: { id: string; name: string }[];
  className?: string;
};

type FieldErrors = Record<string, string[]>;

/**
 * Public inquiry form posted to /api/inquiries. Honeypot field `website` is
 * visually hidden; consent is mandatory; errors come back per field.
 */
export function InquiryForm({ professionalId, professionalName, defaultKind = "contact", requester = null, eventId = null, events = [], className }: InquiryFormProps) {
  const [kind, setKind] = useState<InquiryKind>(defaultKind);
  const [briefEventId, setBriefEventId] = useState<string>(eventId ?? events[0]?.id ?? "");
  const briefEvent = events.find((e) => e.id === briefEventId) ?? null;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      professionalId,
      kind,
      eventId: briefEvent ? briefEvent.id : eventId,
      requesterName: form.get("requesterName"),
      requesterEmail: form.get("requesterEmail"),
      requesterPhone: form.get("requesterPhone"),
      eventTypeLabel: form.get("eventTypeLabel"),
      eventDate: form.get("eventDate"),
      eventCity: form.get("eventCity"),
      guestsCount: form.get("guestsCount") || null,
      childrenCount: form.get("childrenCount") || null,
      message: form.get("message"),
      consent: form.get("consent") === "on",
      website: form.get("website") ?? "",
    };
    try {
      const res = await fetch("/api/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; fieldErrors?: FieldErrors };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Impossible d'envoyer la demande pour le moment.");
        setFieldErrors(data.fieldErrors ?? {});
        return;
      }
      setDone(true);
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className={className} role="status" data-testid="inquiry-success">
        <div className="rounded-2xl bg-success/10 p-5">
          <p className="font-semibold">Demande envoyée à {professionalName}</p>
          <p className="mt-1 text-sm text-muted-foreground">Un e-mail de confirmation vous a été adressé. Le professionnel vous répondra directement.</p>
        </div>
      </div>
    );
  }

  const err = (name: string) => fieldErrors[name]?.[0];

  return (
    <form onSubmit={onSubmit} className={className} noValidate data-testid="inquiry-form" id="contact">
      <FieldGroup>
        <fieldset className="flex flex-wrap gap-2" aria-label="Type de demande">
          {(Object.keys(INQUIRY_KIND_LABELS) as InquiryKind[]).map((k) => (
            <label key={k} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary`}>
              <input type="radio" name="kind" value={k} className="sr-only" checked={kind === k} onChange={() => setKind(k)} />
              {INQUIRY_KIND_LABELS[k]}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(err("requesterName"))}>
            <FieldLabel htmlFor="inq-name">Votre nom</FieldLabel>
            <Input id="inq-name" name="requesterName" autoComplete="name" required defaultValue={requester?.name ?? ""} aria-invalid={Boolean(err("requesterName"))} />
            {err("requesterName") && <FieldError>{err("requesterName")}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(err("requesterEmail"))}>
            <FieldLabel htmlFor="inq-email">Votre e-mail</FieldLabel>
            <Input id="inq-email" name="requesterEmail" type="email" autoComplete="email" required defaultValue={requester?.email ?? ""} aria-invalid={Boolean(err("requesterEmail"))} />
            {err("requesterEmail") && <FieldError>{err("requesterEmail")}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="inq-phone">Téléphone (facultatif)</FieldLabel>
            <Input id="inq-phone" name="requesterPhone" type="tel" autoComplete="tel" />
          </Field>
          {events.length > 0 && (
            <Field>
              <FieldLabel htmlFor="inq-brief">Joindre le brief de</FieldLabel>
              <select id="inq-brief" value={briefEventId} onChange={(e) => setBriefEventId(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
                <option value="">Aucun, je décris ma demande</option>
              </select>
            </Field>
          )}
        </div>
        {briefEvent ? (
          <p className="rounded-xl bg-muted/50 p-3 text-sm text-pretty" data-testid="inquiry-brief-note">
            Le brief de « {briefEvent.name} » est joint : date, lieu, nombre d'invités, style et besoins. Vous pouvez ajouter un mot ci-dessous.
          </p>
        ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="inq-type">Type d'évènement</FieldLabel>
            <select id="inq-type" name="eventTypeLabel" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" defaultValue="">
              <option value="">Choisir</option>
              {EVENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.label}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field data-invalid={Boolean(err("eventDate"))}>
            <FieldLabel htmlFor="inq-date">Date envisagée</FieldLabel>
            <Input id="inq-date" name="eventDate" type="date" />
            {err("eventDate") && <FieldError>{err("eventDate")}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="inq-city">Ville de l'évènement</FieldLabel>
            <Input id="inq-city" name="eventCity" autoComplete="address-level2" />
          </Field>
          <Field>
            <FieldLabel htmlFor="inq-guests">Nombre d'invités</FieldLabel>
            <Input id="inq-guests" name="guestsCount" type="number" min={0} inputMode="numeric" />
          </Field>
          <Field>
            <FieldLabel htmlFor="inq-children">Dont enfants</FieldLabel>
            <Input id="inq-children" name="childrenCount" type="number" min={0} inputMode="numeric" />
          </Field>
        </div>
        )}
        <Field data-invalid={Boolean(err("message"))}>
          <FieldLabel htmlFor="inq-message">{briefEvent ? "Votre message (facultatif)" : "Votre message"}</FieldLabel>
          <Textarea id="inq-message" name="message" rows={briefEvent ? 3 : 5} required={!briefEvent} minLength={briefEvent ? undefined : 10} placeholder={kind === "quote" ? "Décrivez la prestation souhaitée : horaires, nombre d'enfants et âges, lieu…" : "Présentez votre évènement et votre besoin."} aria-invalid={Boolean(err("message"))} />
          <FieldDescription>Ne partagez pas d'information de santé ni de document ici : vous pourrez le faire de manière sécurisée après la mise en relation.</FieldDescription>
          {err("message") && <FieldError>{err("message")}</FieldError>}
        </Field>
        {/* Honeypot: hidden from humans and assistive tech. */}
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label htmlFor="inq-website">Site web</label>
          <input id="inq-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <Field orientation="horizontal" data-invalid={Boolean(err("consent"))}>
          <Checkbox id="inq-consent" name="consent" required />
          <div className="space-y-1">
            <FieldLabel htmlFor="inq-consent" className="font-normal">
              J'accepte que mes coordonnées et mon message soient transmis à {professionalName} pour répondre à ma demande.
            </FieldLabel>
            <FieldDescription>Vos données ne sont utilisées que pour cette mise en relation. Consultez notre politique de confidentialité.</FieldDescription>
            {err("consent") && <FieldError>{err("consent")}</FieldError>}
          </div>
        </Field>
        <FormMessage error={error} />
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? "Envoi…" : kind === "quote" ? "Demander un devis" : kind === "availability" ? "Demander une disponibilité" : "Envoyer ma demande"}
        </Button>
      </FieldGroup>
    </form>
  );
}
