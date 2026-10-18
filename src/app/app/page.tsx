import type { Metadata } from "next";
import { EmailVerificationBanner } from "@/components/identity/email-verification-banner";
import { MyProfessionals, NextActions, QuickActions, RecentNotifications, UpcomingEvents, WelcomeBanner, WelcomeState } from "@/components/identity/home-dashboard";
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
      <PageHeader title={`Bonjour ${dashboard.firstName}`} description={dashboard.isEmpty ? "Votre espace est prêt. Par où souhaitez-vous commencer ?" : "Voici l'essentiel de votre activité."} />
      {!dashboard.emailVerified && <EmailVerificationBanner email={actor.email} />}
      {dashboard.twoFactorRequiredButMissing && <TwoFactorRequiredAlert compact />}
      <WelcomeBanner dashboard={dashboard} />
      {dashboard.isEmpty ? <WelcomeState /> : <NextActions actions={dashboard.nextActions} />}
      {!dashboard.isEmpty && (
        <>
          <UpcomingEvents events={dashboard.upcomingEvents} timezone={dashboard.timezone} />
          <MyProfessionals items={dashboard.professionals} />
        </>
      )}
      <RecentNotifications items={dashboard.unreadNotifications} total={dashboard.unreadCount} timezone={dashboard.timezone} />
      <section aria-label="Raccourcis" className="space-y-3">
        <h2 className="font-heading text-lg font-medium">Raccourcis</h2>
        <QuickActions />
      </section>
    </div>
  );
}
