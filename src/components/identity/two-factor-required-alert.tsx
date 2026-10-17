import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Shown to moderator/admin/super_admin accounts without TOTP. The hard block lives in the admin module. */
export function TwoFactorRequiredAlert({ compact = false }: { compact?: boolean }) {
  return (
    <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
      <ShieldAlert aria-hidden="true" />
      <AlertTitle>Double authentification requise pour les rôles privilégiés</AlertTitle>
      <AlertDescription className="gap-3">
        <p>
          Votre compte dispose de droits d'administration ou de modération. {compact ? "Activez la vérification en deux étapes dès maintenant." : "Sans vérification en deux étapes (application d'authentification), l'accès à l'administration est bloqué et votre compte reste exposé en cas de fuite de mot de passe."}
        </p>
        {compact && (
          <Button asChild size="sm" variant="destructive" className="w-fit">
            <Link href="/app/compte/securite#double-authentification">Activer la double authentification</Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
