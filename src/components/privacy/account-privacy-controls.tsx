"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { resetCookieConsent } from "@/app/(public)/cookies/actions";
import { requestAccountDeletion } from "@/app/app/compte/confidentialite/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { broadcastConsentUpdate } from "./consent-cookie-client";

/** "Ask me again" for cookies: deletes the consent cookie so the banner reappears on the public site. */
export function ResetConsentButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="rounded-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await resetCookieConsent();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          broadcastConsentUpdate();
          toast.success("La bannière cookies sera réaffichée à votre prochaine visite du site public.");
        })
      }
    >
      Réafficher la bannière cookies
    </Button>
  );
}

export function DeleteAccountButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="destructive" className="rounded-full" disabled={disabled}>
          Demander la suppression de mon compte
        </Button>
      }
      title="Demander la suppression du compte ?"
      description="Une demande d'effacement sera transmise à l'équipe, qui la traite sous 30 jours. Vos évènements, fiches et contacts seront supprimés ; certaines données peuvent être conservées temporairement pour des obligations légales (facturation, litige), isolées et inaccessibles. Vous pouvez continuer à utiliser votre compte jusqu'au traitement."
      confirmLabel="Confirmer la demande"
      successMessage="Demande de suppression enregistrée"
      onConfirm={async () => {
        const res = await requestAccountDeletion();
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
