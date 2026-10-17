import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Specimen label: the recurring container of the herbarium world. */
export function LabelCard({
  reference,
  title,
  children,
  className,
  as: Tag = "div",
  padding = "md",
}: {
  reference?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "aside";
  padding?: "sm" | "md" | "lg";
}) {
  const pad = padding === "sm" ? "p-4" : padding === "lg" ? "p-6 sm:p-8" : "p-5 sm:p-6";
  return (
    <Tag className={cn("label-card", pad, className)}>
      {reference ? <p className="mb-2 font-sans text-[13px] font-semibold tracking-[0.01em] text-clay-700 tabular">{reference}</p> : null}
      {title ? <h3 className="font-sans text-lg font-semibold text-ink-900">{title}</h3> : null}
      {children}
    </Tag>
  );
}
