import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/", compact = false }: { className?: string; href?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-heading text-lg font-semibold tracking-tight text-foreground", className)} aria-label="Sous Nos Ailes, accueil">
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden="true">
        <path d="M32 44c-8-2-16-9-20-18 7 0 14 3 20 9 6-6 13-9 20-9-4 9-12 16-20 18z" className="fill-primary" />
        <circle cx="32" cy="24" r="5" className="fill-foreground" />
      </svg>
      {!compact && <span>Sous Nos Ailes</span>}
    </Link>
  );
}
