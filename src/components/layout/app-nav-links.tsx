"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Navigation is text only. `icon` is accepted for callers still passing it and ignored. */
export type NavItem = { href: string; label: string; icon?: string; exact?: boolean; badge?: number };

export function AppNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
