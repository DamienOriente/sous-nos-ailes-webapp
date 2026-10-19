"use client";
import { useActionState } from "react";
import { sendContactMessage, type ContactFormState } from "@/app/(public)/contact/actions";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {errors[0]}
    </p>
  );
}

export function ContactForm({ defaultEmail, defaultName }: { defaultEmail?: string; defaultName?: string }) {
  const [state, action] = useActionState<ContactFormState, FormData>(sendContactMessage, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const v = (key: string, fallback?: string) => state?.values?.[key] ?? fallback;

  if (state?.ok) {
    return (
      <div role="status" className="rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Message envoyé</h2>
        <p className="mt-2 text-muted-foreground">Merci. Nous vous répondons à l'adresse indiquée, en général sous deux jours ouvrés.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage error={state && !state.ok ? state.error : null} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Votre nom</Label>
          <Input id="contact-name" name="name" autoComplete="name" required defaultValue={v("name", defaultName)} aria-invalid={Boolean(errors?.name)} aria-describedby={errors?.name ? "contact-name-error" : undefined} />
          <FieldError id="contact-name-error" errors={errors?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">Votre e-mail</Label>
          <Input id="contact-email" name="email" type="email" autoComplete="email" required defaultValue={v("email", defaultEmail)} aria-invalid={Boolean(errors?.email)} aria-describedby={errors?.email ? "contact-email-error" : undefined} />
          <FieldError id="contact-email-error" errors={errors?.email} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-subject">Sujet</Label>
        <Input id="contact-subject" name="subject" required defaultValue={v("subject")} aria-invalid={Boolean(errors?.subject)} aria-describedby={errors?.subject ? "contact-subject-error" : undefined} />
        <FieldError id="contact-subject-error" errors={errors?.subject} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea id="contact-message" name="message" rows={6} required defaultValue={v("message")} aria-invalid={Boolean(errors?.message)} aria-describedby={errors?.message ? "contact-message-error" : "contact-message-hint"} />
        <p id="contact-message-hint" className="text-xs text-muted-foreground">
          N'indiquez aucune information de santé ni de mot de passe. Pour une demande liée à vos données personnelles, utilisez de préférence votre espace.
        </p>
        <FieldError id="contact-message-error" errors={errors?.message} />
      </div>
      {/* Honeypot: hidden from people, filled by bots. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-website">Ne pas remplir</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <SubmitButton size="lg" className="rounded-full px-5" pendingLabel="Envoi…">
        Envoyer le message
      </SubmitButton>
    </form>
  );
}
