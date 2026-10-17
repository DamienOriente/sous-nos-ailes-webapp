import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Section({ children, className, tone = "ivory", id }: { children: ReactNode; className?: string; tone?: "ivory" | "sage" | "paper"; id?: string }) {
  const tones = {
    ivory: "",
    paper: "bg-ivory-50 border-y border-ivory-300",
    sage: "bg-sage-700 text-ivory-100",
  };
  return (
    <section id={id} className={cn("py-16 sm:py-20 lg:py-24", tones[tone], className)}>
      <div className="container-page">{children}</div>
    </section>
  );
}

export function SectionTitle({ children, className, as: Tag = "h2", light = false }: { children: ReactNode; className?: string; as?: "h1" | "h2" | "h3"; light?: boolean }) {
  return <Tag className={cn("font-display text-[2rem] leading-[1.15] sm:text-[2.5rem]", light ? "text-ivory-50" : "text-ink-900", className)}>{children}</Tag>;
}

export function Lead({ children, className, light = false }: { children: ReactNode; className?: string; light?: boolean }) {
  return <p className={cn("mt-4 max-w-2xl text-[17px] leading-relaxed sm:text-lg", light ? "text-sage-100" : "text-ink-700", className)}>{children}</p>;
}
