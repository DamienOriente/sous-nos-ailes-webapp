import Link from "next/link";
import { KeyRound, MonitorSmartphone, ShieldCheck, ShieldOff } from "lucide-react";
import { ShieldScene } from "@/components/illustrations/app-scenes";
import { cn } from "@/lib/utils";

/**
 * Status strip at the top of the security page: three facts, each linking to
 * its section, with the shield scene. The sections below keep the forms.
 */
export function SecurityOverview({ twoFactorEnabled, required, sessionCount, lastPasswordChange }: { twoFactorEnabled: boolean; required: boolean; sessionCount: number; lastPasswordChange: string | null }) {
  const facts = [
    {
      href: "#double-authentification",
      icon: twoFactorEnabled ? ShieldCheck : ShieldOff,
      label: "Double authentification",
      value: twoFactorEnabled ? "Active sur ce compte" : required ? "Requise, à activer" : "Non activée",
      tone: twoFactorEnabled ? "good" : required ? "bad" : "neutral",
    },
    { href: "#mot-de-passe", icon: KeyRound, label: "Mot de passe", value: lastPasswordChange ? `Modifié le ${lastPasswordChange}` : "Jamais modifié depuis l'inscription", tone: "neutral" },
    { href: "#sessions", icon: MonitorSmartphone, label: "Appareils connectés", value: `${sessionCount} session${sessionCount > 1 ? "s" : ""} active${sessionCount > 1 ? "s" : ""}`, tone: sessionCount > 3 ? "warn" : "neutral" },
  ] as const;
  return (
    <section className="grid gap-4 rounded-3xl border bg-gradient-to-br from-accent/60 via-card to-card p-5 sm:grid-cols-[9rem_1fr] sm:items-center" aria-label="État de la sécurité du compte">
      <ShieldScene className="mx-auto w-28 sm:w-full" />
      <ul className="grid gap-2 sm:grid-cols-3">
        {facts.map((f) => (
          <li key={f.href}>
            <Link href={f.href} className="flex h-full items-start gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/50">
              <f.icon className={cn("mt-0.5 size-4 shrink-0", f.tone === "good" ? "text-success" : f.tone === "bad" ? "text-destructive" : f.tone === "warn" ? "text-warning-foreground" : "text-primary")} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{f.label}</span>
                <span className="block text-sm font-medium">{f.value}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
