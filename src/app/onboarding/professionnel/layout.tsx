import Link from "next/link";
import { requireActor } from "@/lib/session";

/** The shell (banner, logo, theme) comes from /onboarding/layout.tsx; this only adds the way back to the listings. */
export default async function ProfessionalOnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireActor("/onboarding/professionnel");
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/app/pro" className="text-sm text-muted-foreground hover:text-foreground">
          Mes fiches
        </Link>
      </div>
      {children}
    </div>
  );
}
