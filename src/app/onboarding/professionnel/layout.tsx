import Link from "next/link";
import { DemoBanner } from "@/components/shared/demo-banner";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { requireActor } from "@/lib/session";

export default async function ProfessionalOnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireActor("/onboarding/professionnel");
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <DemoBanner />
      <header className="flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <Logo href="/app" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/app/pro" className="text-sm text-muted-foreground hover:text-foreground">
            Mes fiches
          </Link>
        </div>
      </header>
      <main id="contenu" className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
