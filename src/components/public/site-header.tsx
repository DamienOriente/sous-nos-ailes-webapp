"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { NAV_PRIMARY, CTA_HREF, CTA_LABEL } from "@/content/site";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function SiteHeader({ brandName }: { brandName: string }) {
  const pathname = usePathname();
  const menuId = useId();
  // The menu is open only for the path it was opened on: navigating closes it without an effect.
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const open = openOnPath === pathname;
  const setOpen = (next: boolean | ((previous: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    setOpenOnPath(value ? pathname : null);
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b border-sage-200/80 bg-ivory-100/95">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link href="/" className="font-display text-xl leading-tight text-sage-800 whitespace-nowrap sm:text-2xl sm:leading-none">
          <span className="sm:hidden">{brandName.split(/\s[—-]\s/)[0]}</span>
          <span className="hidden sm:inline">{brandName}</span>
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-6 lg:flex xl:gap-7">
          {NAV_PRIMARY.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("specimen-link whitespace-nowrap text-[15px] font-medium text-ink-700 hover:text-sage-900", active && "text-sage-900")}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <Link href={CTA_HREF} className={buttonClasses({ size: "sm" })}>
              {CTA_LABEL}
            </Link>
          </div>
          <button
            type="button"
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-sm border border-sage-300 text-sage-800 lg:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? "Fermer le menu" : "Ouvrir le menu"}</span>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              {open ? <path d="M4 4l12 12M16 4L4 16" /> : <path d="M3 5h14M3 10h14M3 15h14" />}
            </svg>
          </button>
        </div>
      </div>
      <div id={menuId} hidden={!open} className="border-t border-sage-200 bg-ivory-50 lg:hidden">
        <nav aria-label="Navigation mobile" className="container-page flex flex-col py-3">
          {NAV_PRIMARY.map((item) => (
            <Link key={item.href} href={item.href} className="border-b border-sage-100 py-3 text-[17px] font-medium text-ink-900 last:border-b-0">
              {item.label}
            </Link>
          ))}
          <Link href={CTA_HREF} className={buttonClasses({ className: "mt-3 w-full" })}>
            {CTA_LABEL}
          </Link>
        </nav>
      </div>
    </header>
  );
}
