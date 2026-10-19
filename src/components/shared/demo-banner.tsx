import Link from "next/link";
import { isDemo } from "@/lib/env";

/** Visible on every page in demo mode so synthetic data is never mistaken for real. */
export function DemoBanner() {
  if (!isDemo) return null;
  return (
    <div className="border-b border-warning/40 bg-warning/20 px-4 py-1.5 text-center text-xs font-medium text-foreground" role="note">
      Environnement de démonstration : comptes, professionnels et évènements fictifs. Aucune donnée réelle, aucun paiement réel.{" "}
      <Link href="/connexion?changer=1" className="underline underline-offset-2 hover:no-underline">
        Changer de compte
      </Link>
    </div>
  );
}
