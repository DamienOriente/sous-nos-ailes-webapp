"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCookieConsent } from "@/app/(public)/cookies/actions";
import { Button } from "@/components/ui/button";
import { ALL_ACCEPTED, ALL_REFUSED, type ConsentChoices } from "@/modules/privacy/domain/consent";
import { broadcastConsentUpdate, CONSENT_EVENT, hasCurrentConsent } from "./consent-cookie-client";

/**
 * Cookie banner. Refusing is exactly as easy as accepting (two buttons, same
 * variant, same size), nothing is pre-ticked, no dark pattern. Hidden on the
 * cookie policy page, where the detailed preferences live.
 */
export function CookieBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const refresh = () => setVisible(!hasCurrentConsent());
    refresh();
    window.addEventListener(CONSENT_EVENT, refresh);
    return () => window.removeEventListener(CONSENT_EVENT, refresh);
  }, []);

  if (!visible || pathname === "/cookies") return null;

  const decide = (choices: ConsentChoices) =>
    start(async () => {
      const res = await saveCookieConsent(choices);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setVisible(false);
      broadcastConsentUpdate();
    });

  return (
    <section
      role="region"
      aria-label="Choix des cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border bg-card p-4 text-card-foreground shadow-lift sm:inset-x-6 sm:bottom-6 sm:p-5"
      data-testid="cookie-banner"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-heading text-base font-semibold">Vos cookies, votre choix</p>
          <p className="text-sm text-muted-foreground text-pretty">
            Nous utilisons uniquement des cookies nécessaires au fonctionnement du site. Aucun outil de mesure d'audience ni de marketing n'est actif pour l'instant ; nous enregistrons votre choix pour l'avenir.{" "}
            <Link href="/cookies#preferences" className="underline underline-offset-4 hover:text-foreground">
              Personnaliser
            </Link>
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-auto">
          <Button type="button" variant="outline" size="lg" className="rounded-full" disabled={pending} onClick={() => decide(ALL_REFUSED)}>
            Tout refuser
          </Button>
          <Button type="button" variant="outline" size="lg" className="rounded-full" disabled={pending} onClick={() => decide(ALL_ACCEPTED)}>
            Tout accepter
          </Button>
        </div>
      </div>
    </section>
  );
}
