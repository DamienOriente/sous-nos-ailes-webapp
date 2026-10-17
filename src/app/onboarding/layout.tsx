import { DemoBanner } from "@/components/shared/demo-banner";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { requireActor } from "@/lib/session";

/** Lightweight shell for the first steps after sign-up (no sidebar yet). */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireActor("/onboarding");
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        <ThemeToggle />
      </header>
      <main id="contenu" className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-10">
        <div className="w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
