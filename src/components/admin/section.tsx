import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Titled block of an admin page. Headings stay in the sans family: private
 * spaces use a single text family (the display serif belongs to the public site).
 */
export function AdminSection({
  id,
  title,
  description,
  actions,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-sans text-lg font-semibold text-ink-900">
            {title}
          </h2>
          {description ? <p className="mt-1 max-w-2xl text-sm leading-snug text-ink-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Secondary heading inside a section (sans, smaller). */
export function SubHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("font-sans text-[15px] font-semibold text-ink-900", className)}>{children}</h3>;
}

/** Collapsed secondary form, used instead of a modal. */
export function Disclosure({ summary, children, className, open }: { summary: ReactNode; children: ReactNode; className?: string; open?: boolean }) {
  return (
    <details open={open} className={cn("group rounded-md border border-sage-200 bg-ivory-50", className)}>
      <summary className="cursor-pointer list-none px-4 py-3 text-[15px] font-semibold text-sage-800 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-block w-4 text-ink-500 transition-transform group-open:rotate-90" aria-hidden="true">
          ›
        </span>
        {summary}
      </summary>
      <div className="border-t border-sage-100 px-4 py-4">{children}</div>
    </details>
  );
}

export function HelpText({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm leading-snug text-ink-500", className)}>{children}</p>;
}
