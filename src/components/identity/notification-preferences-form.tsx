"use client";
import { useId, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateNotificationPreferencesAction } from "@/app/app/compte/notifications/actions";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import type { NotificationPreferencesView } from "@/modules/identity/application/profile-service";
import { EMAIL_DIGEST_LABELS, EMAIL_DIGESTS, NOTIFICATION_TYPE_OPTIONS, type EmailDigest, type NotificationPreferencesInput } from "@/modules/identity/domain/notification-preferences";
import { cn } from "@/lib/utils";

export function NotificationPreferencesForm({ initial }: { initial: NotificationPreferencesView }) {
  const base = useId();
  const [prefs, setPrefs] = useState<NotificationPreferencesInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const result = await updateNotificationPreferencesAction(prefs);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Préférences enregistrées.");
    });
  }

  const emailOff = !prefs.emailEnabled;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-8"
    >
      <FormMessage error={error} />
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">E-mails de notification</h2>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <Label htmlFor={`${base}-email`} className="text-base">
              Recevoir des e-mails
            </Label>
            <p className="text-sm text-muted-foreground">Les notifications restent toujours visibles dans l'application.</p>
          </div>
          <Switch id={`${base}-email`} checked={prefs.emailEnabled} onCheckedChange={(v) => setPrefs((p) => ({ ...p, emailEnabled: v }))} />
        </div>
        <fieldset disabled={emailOff} className={cn("space-y-3", emailOff && "opacity-60")}>
          <legend className="mb-2 text-sm font-medium">Fréquence</legend>
          <RadioGroup value={prefs.emailDigest} onValueChange={(v) => setPrefs((p) => ({ ...p, emailDigest: v as EmailDigest }))} className="gap-2">
            {EMAIL_DIGESTS.map((d) => (
              <Label key={d} htmlFor={`${base}-digest-${d}`} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5">
                <RadioGroupItem id={`${base}-digest-${d}`} value={d} className="mt-0.5" />
                <span>
                  <span className="block font-medium">{EMAIL_DIGEST_LABELS[d].label}</span>
                  <span className="block text-sm text-muted-foreground">{EMAIL_DIGEST_LABELS[d].description}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Par type de notification</h2>
          <p className="text-sm text-muted-foreground">Désactivez les e-mails que vous ne souhaitez pas recevoir. Les alertes de sécurité sont toujours envoyées.</p>
        </div>
        <ul className={cn("divide-y rounded-xl border", emailOff && "opacity-60")}>
          {NOTIFICATION_TYPE_OPTIONS.map((opt) => {
            const checked = prefs.types[opt.key] ?? true;
            return (
              <li key={opt.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <Label htmlFor={`${base}-${opt.key}`} className="font-medium">
                    {opt.label}
                  </Label>
                  {opt.description && <p className="text-sm text-muted-foreground">{opt.description}</p>}
                </div>
                <Switch id={`${base}-${opt.key}`} checked={checked} disabled={emailOff} onCheckedChange={(v) => setPrefs((p) => ({ ...p, types: { ...p.types, [opt.key]: v } }))} />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Communications</h2>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <Label htmlFor={`${base}-marketing`} className="text-base">
              Nouveautés et conseils par e-mail
            </Label>
            <p className="text-sm text-muted-foreground">Consentement distinct des notifications, révocable à tout moment. Nous enregistrons la date de votre choix.</p>
          </div>
          <Switch id={`${base}-marketing`} checked={prefs.marketingEmails} onCheckedChange={(v) => setPrefs((p) => ({ ...p, marketingEmails: v }))} />
        </div>
      </section>

      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Enregistrer mes préférences
      </Button>
    </form>
  );
}
