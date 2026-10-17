import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TWO_FACTOR_SETUP_PATH } from "@/modules/admin/application/privileged-guard";

/** Shown on every admin page (local/demo) while a privileged account has no 2FA. In production the page redirects instead. */
export function TwoFactorBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Alert className="border-warning/50 bg-warning/15" role="status">
      <ShieldAlert className="text-warning-foreground" />
      <AlertTitle>Double authentification requise pour les rôles privilégiés</AlertTitle>
      <AlertDescription>
        Votre compte (modérateur ou administrateur) n'a pas activé la double authentification. En production, l'accès à l'administration serait bloqué jusqu'à son activation.{" "}
        <Link href={TWO_FACTOR_SETUP_PATH} className="font-medium underline">
          Activer la 2FA
        </Link>
      </AlertDescription>
    </Alert>
  );
}
