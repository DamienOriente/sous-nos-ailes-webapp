import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/lib/auth/session";
import { DemoBanner } from "@/components/shell/demo-banner";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; exact?: boolean };

/**
 * Operate-mode shell shared by every private space: top bar, side navigation
 * on desktop (horizontal on mobile), one text family, restrained colour.
 */
export function PrivateShell({
  user,
  spaceLabel,
  nav,
  currentPath,
  children,
  brandName,
}: {
  user: SessionUser;
  spaceLabel: string;
  nav: NavItem[];
  currentPath: string;
  children: ReactNode;
  brandName: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-ivory-100">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-ivory-50 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-sage-800 focus:shadow-card">
        Aller au contenu
      </a>
      <DemoBanner compact />
      <header className="no-print border-b border-sage-200 bg-ivory-50">
        <div className="container-page flex h-14 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="shrink-0 font-display text-lg leading-none whitespace-nowrap text-sage-800">
              <span className="sm:hidden">{brandName.split(/\s[—-]\s/)[0]}</span>
              <span className="hidden sm:inline">{brandName}</span>
            </Link>
            <span aria-hidden="true" className="hidden h-5 w-px bg-sage-200 sm:block" />
            <span className="hidden truncate text-sm font-semibold text-ink-500 sm:block">{spaceLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-ink-700 md:block">{user.name}</span>
            <form action={signOutAction}>
              <button type="submit" className="h-9 cursor-pointer rounded-sm border border-sage-300 px-3 text-sm font-semibold whitespace-nowrap text-sage-800 transition-colors hover:bg-sage-50">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="container-page flex flex-1 flex-col gap-6 py-6 lg:flex-row lg:gap-10 lg:py-8">
        <nav aria-label={spaceLabel} className="no-print -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0 lg:w-56 lg:shrink-0">
          <ul className="flex gap-1 lg:flex-col">
            {nav.map((item) => {
              const active = item.exact ? currentPath === item.href : currentPath === item.href || currentPath.startsWith(`${item.href}/`);
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-sm px-3 py-2 text-[15px] font-medium transition-colors",
                      active ? "bg-sage-700 text-ivory-50" : "text-ink-700 hover:bg-sage-50 hover:text-sage-900",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main id="contenu" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
