import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { Sprig } from "@/components/illustrations/botanical";

/** Editorial page opening: breadcrumbs, title, lead, optional sprig. */
export function PageIntro({ title, lead, crumbs, sprig = "sage", children }: { title: string; lead?: ReactNode; crumbs: Array<{ name: string; path: string }>; sprig?: "sage" | "olive" | "eucalyptus" | "gypsophila" | "fern"; children?: ReactNode }) {
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <header className="container-page pt-8 pb-10 sm:pt-12 sm:pb-14">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <h1 className="font-display text-[2.5rem] leading-[1.08] text-ink-900 sm:text-[3.25rem]">{title}</h1>
            {lead ? <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-700 sm:text-lg">{lead}</p> : null}
            {children}
          </div>
          <Sprig kind={sprig} size={96} className="hidden lg:block" />
        </div>
      </header>
    </>
  );
}
