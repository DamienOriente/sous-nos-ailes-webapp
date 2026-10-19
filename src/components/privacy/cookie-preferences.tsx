"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCookieConsent } from "@/app/(public)/cookies/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CONSENT_CATEGORIES, type ConsentChoices } from "@/modules/privacy/domain/consent";
import { broadcastConsentUpdate, CONSENT_EVENT, readConsentCookie } from "./consent-cookie-client";

/** Detailed cookie preferences (anchored at /cookies#preferences and reused in the account). */
export function CookiePreferences() {
  const [choices, setChoices] = useState<ConsentChoices>({ analytics: false, marketing: false });
  const [decidedAt, setDecidedAt] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const refresh = () => {
      const state = readConsentCookie();
      if (state) {
        setChoices(state.choices);
        setDecidedAt(state.decidedAt);
      } else {
        setDecidedAt(null);
      }
    };
    refresh();
    window.addEventListener(CONSENT_EVENT, refresh);
    return () => window.removeEventListener(CONSENT_EVENT, refresh);
  }, []);

  const save = (next: ConsentChoices) =>
    start(async () => {
      const res = await saveCookieConsent(next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setChoices(next);
      setDecidedAt(res.data.decidedAt);
      broadcastConsentUpdate();
      toast.success("Préférences enregistrées");
    });

  return (
    <form
      id="preferences"
      className="scroll-mt-24 space-y-5 rounded-2xl border bg-card p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save(choices);
      }}
      aria-labelledby="preferences-title"
    >
      <div>
        <h2 id="preferences-title" className="text-lg font-semibold">
          Mes préférences
        </h2>
        <p className="text-sm text-muted-foreground">
          {decidedAt ? `Dernier choix enregistré le ${new Date(decidedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.` : "Aucun choix enregistré pour l'instant."}
        </p>
      </div>
      <ul className="divide-y">
        {CONSENT_CATEGORIES.map((cat) => {
          const id = `consent-${cat.key}`;
          const checked = cat.required ? true : choices[cat.key as keyof ConsentChoices];
          return (
            <li key={cat.key} className="flex items-start justify-between gap-4 py-4">
              <div className="space-y-1">
                <label htmlFor={id} className="font-medium">
                  {cat.label}
                </label>
                <p className="text-sm text-muted-foreground text-pretty">{cat.description}</p>
              </div>
              <Switch
                id={id}
                checked={checked}
                disabled={cat.required || pending}
                onCheckedChange={(v) => {
                  if (cat.required) return;
                  setChoices((c) => ({ ...c, [cat.key]: v }));
                }}
              />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="lg" className="rounded-full" disabled={pending}>
          Enregistrer mes préférences
        </Button>
        <Button type="button" size="lg" variant="outline" className="rounded-full" disabled={pending} onClick={() => save({ analytics: false, marketing: false })}>
          Tout refuser
        </Button>
      </div>
    </form>
  );
}
