import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { DemoBanner } from "@/components/shared/demo-banner";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Actor } from "@/lib/session";
import { canGlobal } from "@/modules/authorization";
import { proNavLabel } from "@/modules/professionals/application/agency-service";
import { initials } from "@/lib/utils";
import { AppNavLinks, type NavItem } from "./app-nav-links";
import { SignOutButton } from "./sign-out-button";

const PRIMARY_NAV: NavItem[] = [
  { href: "/app", label: "Accueil", exact: true },
  { href: "/app/evenements", label: "Mes évènements" },
  { href: "/app/pro", label: "Ma fiche pro" },
  { href: "/app/calendrier", label: "Calendrier" },
  { href: "/app/contacts", label: "Contacts" },
  { href: "/app/notifications", label: "Notifications" },
  { href: "/app/compte", label: "Mon compte" },
];

/**
 * Authenticated shell: sidebar on desktop, sheet on mobile. `secondaryNav`
 * lets a workspace (event, professional listing) add its own section.
 */
export async function AppShell({
  actor,
  children,
  unreadCount = 0,
  secondaryNav,
}: {
  actor: Actor;
  children: React.ReactNode;
  unreadCount?: number;
  secondaryNav?: { title: string; items: NavItem[] };
}) {
  const proLabel = await proNavLabel(actor.userId);
  const nav = PRIMARY_NAV.map((i) => (i.href === "/app/notifications" ? { ...i, badge: unreadCount } : i.href === "/app/pro" ? { ...i, label: proLabel } : i));
  const showAdmin = canGlobal(actor, "admin.dashboard");
  const sidebar = (
    <div className="flex h-full flex-col gap-6">
      <AppNavLinks items={nav} />
      {secondaryNav && secondaryNav.items.length > 0 && (
        <div>
          <p className="mb-2 px-3 text-sm font-semibold text-foreground">{secondaryNav.title}</p>
          <AppNavLinks items={secondaryNav.items} />
        </div>
      )}
      {showAdmin && (
        <div className="mt-auto">
          <AppNavLinks items={[{ href: "/admin", label: "Administration" }]} />
        </div>
      )}
    </div>
  );
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar px-3 py-5 lg:flex" aria-label="Navigation de l'espace">
          <div className="mb-6 px-3">
            <Logo href="/app" />
          </div>
          <div className="flex-1 overflow-y-auto">{sidebar}</div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background px-4 sm:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Ouvrir la navigation">
                    <Menu className="size-5" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 px-3 py-5">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="mb-6 px-3">
                    <Logo href="/app" />
                  </div>
                  {sidebar}
                </SheetContent>
              </Sheet>
              <Logo href="/app" compact />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <Button asChild variant="ghost" size="icon" aria-label={unreadCount > 0 ? `${unreadCount} notifications non lues` : "Notifications"}>
                <Link href="/app/notifications" className="relative">
                  <Bell className="size-4" aria-hidden="true" />
                  {unreadCount > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive" aria-hidden="true" />}
                </Link>
              </Button>
              <Link href="/app/compte" className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-muted" aria-label="Mon compte">
                <Avatar className="size-7">
                  <AvatarFallback className="text-xs">{initials(actor.name)}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{actor.name}</span>
              </Link>
              <SignOutButton />
            </div>
          </header>
          <main id="contenu" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
