import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getActor } from "@/lib/session";

const NAV = [
  { href: "/annuaire/garde-enfants-evenementielle", label: "Garde d'enfants" },
  { href: "/annuaire", label: "Tous les professionnels" },
  { href: "/organiser", label: "Organiser un évènement" },
  { href: "/professionnels", label: "Vous êtes professionnel ?" },
  { href: "/tarifs", label: "Tarifs" },
];

export async function SiteHeader() {
  const actor = await getActor();
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {actor ? (
            <Button asChild size="lg" className="rounded-full">
              <Link href="/app">Mon espace</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" size="lg" className="hidden rounded-full sm:inline-flex">
                <Link href="/connexion">Connexion</Link>
              </Button>
              <Button asChild size="lg" className="rounded-full">
                <Link href="/inscription">Commencer</Link>
              </Button>
            </>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu">
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <nav className="mt-8 flex flex-col gap-1 px-2" aria-label="Navigation mobile">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">
                    {item.label}
                  </Link>
                ))}
                {!actor && (
                  <Link href="/connexion" className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">
                    Connexion
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
