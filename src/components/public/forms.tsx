"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendContactMessage, sendPartnerApplication, sendProviderApplication } from "@/server/actions/public";
import { idleState, type ActionState } from "@/server/action-state";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
      {pending ? "Envoi en cours…" : label}
    </Button>
  );
}

function Honeypot() {
  return (
    <div className="hidden" aria-hidden="true">
      <label htmlFor="website">Site web</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

function PrivacyNotice({ id, error }: { id: string; error?: string[] }) {
  return (
    <div>
      <Checkbox
        id={id}
        name="privacyAccepted"
        label={
          <>
            J’ai pris connaissance de la{" "}
            <Link href="/confidentialite" className="underline">
              politique de confidentialité
            </Link>
            . Les informations saisies servent uniquement à traiter ma demande.
          </>
        }
      />
      {error ? (
        <p role="alert" className="mt-1 text-sm font-medium text-danger-600">
          {error.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.status === "success") return <Alert kind="success" role="status">{state.message}</Alert>;
  if (state.status === "error") return <Alert kind="danger" role="alert">{state.message}</Alert>;
  return null;
}

export function ContactForm() {
  const [state, action] = useActionState(sendContactMessage, idleState);
  const e = state.fieldErrors ?? {};
  if (state.status === "success") return <Feedback state={state} />;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Feedback state={state} />
      <Honeypot />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Votre nom" htmlFor="contact-name" error={e.name} required>
          <Input id="contact-name" name="name" autoComplete="name" required invalid={Boolean(e.name)} />
        </Field>
        <Field label="Votre email" htmlFor="contact-email" error={e.email} required>
          <Input id="contact-email" name="email" type="email" autoComplete="email" inputMode="email" required invalid={Boolean(e.email)} />
        </Field>
      </div>
      <Field label="Objet" htmlFor="contact-subject" error={e.subject} optionalLabel>
        <Input id="contact-subject" name="subject" invalid={Boolean(e.subject)} />
      </Field>
      <Field label="Votre message" htmlFor="contact-message" error={e.message} required help="Merci de ne pas y inscrire d’information médicale ou sensible concernant des enfants.">
        <Textarea id="contact-message" name="message" required rows={6} invalid={Boolean(e.message)} />
      </Field>
      <PrivacyNotice id="contact-privacy" error={e.privacyAccepted} />
      <div>
        <Submit label="Envoyer le message" />
      </div>
    </form>
  );
}

export function ProviderApplicationForm() {
  const [state, action] = useActionState(sendProviderApplication, idleState);
  const e = state.fieldErrors ?? {};
  if (state.status === "success") return <Feedback state={state} />;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Feedback state={state} />
      <Honeypot />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Votre nom" htmlFor="pa-name" error={e.name} required>
          <Input id="pa-name" name="name" autoComplete="name" required invalid={Boolean(e.name)} />
        </Field>
        <Field label="Votre email" htmlFor="pa-email" error={e.email} required>
          <Input id="pa-email" name="email" type="email" autoComplete="email" required invalid={Boolean(e.email)} />
        </Field>
        <Field label="Téléphone" htmlFor="pa-phone" error={e.phone} optionalLabel>
          <Input id="pa-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" invalid={Boolean(e.phone)} />
        </Field>
        <Field label="Votre commune" htmlFor="pa-city" error={e.city} required>
          <Input id="pa-city" name="city" autoComplete="address-level2" required invalid={Boolean(e.city)} />
        </Field>
      </div>
      <Field label="Secteur où vous pouvez intervenir" htmlFor="pa-sector" error={e.sector} required help="Par exemple : « Lyon et métropole », « Beaujolais », « jusqu’à 50 km autour de Mâcon ».">
        <Input id="pa-sector" name="sector" required invalid={Boolean(e.sector)} />
      </Field>
      <Field label="Présentez-vous en quelques lignes" htmlFor="pa-message" error={e.message} required help="Expérience auprès des enfants, formations déclarées, disponibilités habituelles. Les justificatifs seront demandés plus tard, lors d’un échange avec Marie.">
        <Textarea id="pa-message" name="message" required rows={7} invalid={Boolean(e.message)} />
      </Field>
      <PrivacyNotice id="pa-privacy" error={e.privacyAccepted} />
      <div>
        <Submit label="Envoyer ma candidature" />
      </div>
    </form>
  );
}

export function PartnerApplicationForm() {
  const [state, action] = useActionState(sendPartnerApplication, idleState);
  const e = state.fieldErrors ?? {};
  if (state.status === "success") return <Feedback state={state} />;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Feedback state={state} />
      <Honeypot />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Votre nom" htmlFor="pt-name" error={e.name} required>
          <Input id="pt-name" name="name" autoComplete="name" required invalid={Boolean(e.name)} />
        </Field>
        <Field label="Nom du lieu" htmlFor="pt-organisation" error={e.organisation} required>
          <Input id="pt-organisation" name="organisation" autoComplete="organization" required invalid={Boolean(e.organisation)} />
        </Field>
        <Field label="Votre email professionnel" htmlFor="pt-email" error={e.email} required>
          <Input id="pt-email" name="email" type="email" autoComplete="email" required invalid={Boolean(e.email)} />
        </Field>
        <Field label="Téléphone" htmlFor="pt-phone" error={e.phone} optionalLabel>
          <Input id="pt-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" invalid={Boolean(e.phone)} />
        </Field>
      </div>
      <Field label="Commune du lieu" htmlFor="pt-city" error={e.city} required>
        <Input id="pt-city" name="city" required invalid={Boolean(e.city)} />
      </Field>
      <Field label="Votre message" htmlFor="pt-message" error={e.message} required help="Type d’événements accueillis, espaces disponibles pour les enfants, ce que vous attendez du partenariat.">
        <Textarea id="pt-message" name="message" required rows={6} invalid={Boolean(e.message)} />
      </Field>
      <PrivacyNotice id="pt-privacy" error={e.privacyAccepted} />
      <div>
        <Submit label="Proposer un partenariat" />
      </div>
    </form>
  );
}
