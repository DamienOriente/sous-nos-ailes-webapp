import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/identity/change-password-form";
import { SecurityLog } from "@/components/identity/security-log";
import { SessionsList } from "@/components/identity/sessions-list";
import { TwoFactorRequiredAlert } from "@/components/identity/two-factor-required-alert";
import { TwoFactorSettings } from "@/components/identity/two-factor-settings";
import { headers } from "next/headers";
import { getSession, requireActor } from "@/lib/session";
import { getProfile } from "@/modules/identity/application/profile-service";
import { isTwoFactorEnabled, listMySecurityEvents } from "@/modules/identity/application/security-service";
import { listMySessions } from "@/modules/identity/application/session-service";
import { isPrivilegedRole } from "@/modules/identity/domain/security";

export const metadata: Metadata = { title: "Sécurité du compte" };

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="space-y-4 scroll-mt-24">
      <div>
        <h2 id={`${id}-title`} className="font-heading text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function SecurityPage() {
  const actor = await requireActor("/app/compte/securite");
  const session = await getSession();
  const [profile, twoFactorEnabled, sessions, events] = await Promise.all([
    getProfile(actor),
    isTwoFactorEnabled(actor.userId),
    listMySessions(await headers(), session?.session.id ?? ""),
    listMySecurityEvents(actor, 20),
  ]);
  const privileged = isPrivilegedRole(actor.globalRole);

  return (
    <div className="space-y-10">
      {privileged && !twoFactorEnabled && <TwoFactorRequiredAlert />}
      <Section id="double-authentification" title="Double authentification" description="Protège votre compte même si votre mot de passe est compromis.">
        <TwoFactorSettings enabled={twoFactorEnabled} required={privileged} />
      </Section>
      <Section id="mot-de-passe" title="Mot de passe" description="Au moins 10 caractères. Un gestionnaire de mots de passe reste la meilleure option.">
        <ChangePasswordForm />
      </Section>
      <Section id="sessions" title="Appareils connectés" description="Les sessions actives de votre compte. Déconnectez celles que vous ne reconnaissez pas.">
        <SessionsList sessions={sessions} timezone={profile.timezone} />
      </Section>
      <Section id="journal" title="Activité récente" description="Les 20 derniers évènements de sécurité liés à votre compte.">
        <SecurityLog events={events} timezone={profile.timezone} />
      </Section>
    </div>
  );
}
