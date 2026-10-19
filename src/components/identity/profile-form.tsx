"use client";
import { useActionState, useEffect, useId } from "react";
import { toast } from "sonner";
import { updateProfileAction, type ProfileFormState } from "@/app/app/compte/actions";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfileView } from "@/modules/identity/application/profile-service";
import { LOCALES, TIMEZONES } from "@/modules/identity/domain/profile";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-50 dark:bg-input/30";

function tzLabel(tz: string): string {
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  try {
    const offset = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value;
    return offset ? `${city} (${offset})` : city;
  } catch {
    return city;
  }
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ProfileForm({ profile }: { profile: ProfileView }) {
  const [state, action] = useActionState<ProfileFormState, FormData>(updateProfileAction, null);
  const base = useId();
  const id = (f: string) => `${base}-${f}`;
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const err = (field: string) => errors[field]?.[0];

  useEffect(() => {
    if (state?.ok) toast.success("Profil enregistré.");
  }, [state]);

  const a11y = (name: string, hint?: boolean) => ({
    id: id(name),
    name,
    "aria-invalid": err(name) ? true : undefined,
    "aria-describedby": err(name) ? `${id(name)}-error` : hint ? `${id(name)}-hint` : undefined,
  });

  return (
    <form action={action} className="space-y-6" noValidate>
      {state && !state.ok && <FormMessage error={state.error} />}
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Identité</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={id("firstName")} error={err("firstName")} label="Prénom">
            <Input {...a11y("firstName")} defaultValue={profile.firstName} autoComplete="given-name" required maxLength={80} />
          </Field>
          <Field id={id("lastName")} error={err("lastName")} label="Nom">
            <Input {...a11y("lastName")} defaultValue={profile.lastName} autoComplete="family-name" required maxLength={80} />
          </Field>
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("email")}>Adresse e-mail</Label>
          <Input id={id("email")} value={profile.email} readOnly disabled aria-describedby={id("email-hint")} />
          <p id={id("email-hint")} className="text-xs text-muted-foreground">
            {profile.emailVerified ? "Adresse confirmée. Le changement d'adresse n'est pas disponible pour l'instant : contactez le support." : "Adresse non confirmée : cliquez sur le lien reçu par e-mail."}
          </p>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Coordonnées</h2>
        <Field id={id("phone")} error={err("phone")} label="Téléphone (facultatif)" hint="Visible uniquement par les membres des évènements que vous partagez.">
          <Input {...a11y("phone", true)} defaultValue={profile.phone ?? ""} type="tel" inputMode="tel" autoComplete="tel" maxLength={30} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field id={id("city")} error={err("city")} label="Ville (facultatif)">
            <Input {...a11y("city")} defaultValue={profile.city ?? ""} autoComplete="address-level2" maxLength={120} />
          </Field>
          <Field id={id("postalCode")} error={err("postalCode")} label="Code postal">
            <Input {...a11y("postalCode")} defaultValue={profile.postalCode ?? ""} autoComplete="postal-code" inputMode="numeric" maxLength={12} />
          </Field>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Préférences d'affichage</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={id("timezone")} error={err("timezone")} label="Fuseau horaire" hint="Les dates et heures de vos évènements s'affichent dans ce fuseau.">
            <select {...a11y("timezone", true)} defaultValue={profile.timezone} className={cn(selectClass)}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tzLabel(tz)}
                </option>
              ))}
            </select>
          </Field>
          <Field id={id("locale")} error={err("locale")} label="Langue">
            <select {...a11y("locale")} defaultValue={profile.locale} className={cn(selectClass)}>
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
