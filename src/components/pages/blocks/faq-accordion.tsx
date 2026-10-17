"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/** Accessible accordion (button + region, aria-expanded). One item open at a time, first open by default. */
export function FaqAccordion({ items, variant = "lines" }: { items: Array<{ question: string; answer: string }>; variant?: "lines" | "cards" | "plain" }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <div className={cn(variant === "lines" && "divide-y divide-(--pg-border) border-y border-(--pg-border)", variant === "cards" && "space-y-3")}>
      {items.map((it, i) => {
        const isOpen = open === i;
        const btnId = `${base}-b${i}`;
        const panelId = `${base}-p${i}`;
        return (
          <div key={i} className={cn(variant === "cards" && "rounded-(--pg-radius-md) border border-(--pg-border) bg-(--pg-surface)")}>
            <h3 className="m-0">
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className={cn("flex w-full items-center justify-between gap-4 py-4 text-left text-base font-medium hover:text-(--pg-accent)", variant === "cards" && "px-4", variant === "plain" && "py-3")}
                style={{ fontFamily: "var(--pg-font-body)" }}
              >
                <span>{it.question}</span>
                <span aria-hidden="true" className={cn("shrink-0 text-(--pg-accent) transition-transform", isOpen && "rotate-45")}>
                  <svg viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-[1.8]">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                </span>
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={btnId} hidden={!isOpen} className={cn("pb-5 text-(--pg-muted) text-pretty", variant === "cards" && "px-4")}>
              <p>{it.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
