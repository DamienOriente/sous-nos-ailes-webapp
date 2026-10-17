import type { Metadata } from "next";
import { EmailVerificationBanner } from "@/components/identity/email-verification-banner";
import { MyProfessionals, QuickActions, RecentNotifications, UpcomingEvents, WelcomeState } from "@/components/identity/home-dashboard";
import { TwoFactorRequiredAlert } from "@/components/identity/two-factor-required-alert";
import { PageHeader } from "@/components/shared/page-header";
import { requireActor } from "@/lib/session";
import { getHomeDashboard } from "@/modules/identity/application/home-dashboard";

export const metadata: Metadata = { title: "Mon espace" };

export default async function AppHomePage() {
  const actor = await requireActor("/app");
  const dashboard = await getHomeDashboard(actor);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Mon espace"
        title={`Bonjour ${dashboard.firstName}`}
        description={dashboard.isEmpty ? "Votre espace est prêt. Par où souhaitez-vous commencer ?" : "Voici l'essentiel de votre activité."}
      />
      {!dashboard.emailVerified && <EmailVerificationBanner email={actor.email} />}
      {dashboard.twoFactorRequiredButMissing && <TwoFactorRequiredAlert compact />}
      {dashboard.isEmpty ? (
        <WelcomeState />
      ) : (
        <section aria-label="Raccourcis">
          <QuickActions />
        </section>
      )}
      <RecentNotifications items={dashboard.unreadNotifications} total={dashboard.unreadCount} timezone={dashboard.timezone} />
      {!dashboard.isEmpty && (
        <div className="grid gap-6 lg:grid-cols-2">
          <UpcomingEvents events={dashboard.upcomingEvents} timezone={dashboard.timezone} />
          <MyProfessionals items={dashboard.professionals} />
        </div>
      )}
      {dashboard.isEmpty && (
        <section aria-label="Raccourcis" className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Raccourcis</h2>
          <QuickActions />
        </section>
      )}
    </div>
  );
}
