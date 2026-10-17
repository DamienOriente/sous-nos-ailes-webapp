"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ICONS } from "./nav-icons";

export type NavItem = { href: string; label: string; icon?: string; exact?: boolean; badge?: number };

export function AppNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon ? NAV_ICONS[item.icon] : undefined;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
