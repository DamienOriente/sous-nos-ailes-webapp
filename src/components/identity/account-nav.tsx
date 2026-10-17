"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app/compte", label: "Profil", exact: true },
  { href: "/app/compte/securite", label: "Sécurité" },
  { href: "/app/compte/notifications", label: "Notifications" },
  { href: "/app/compte/abonnement", label: "Abonnement" },
  { href: "/app/compte/confidentialite", label: "Confidentialité et données" },
];

/** Horizontal, scrollable sub-navigation of the account area. */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections du compte" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
