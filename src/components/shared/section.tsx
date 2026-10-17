import { cn } from "@/lib/utils";

/** Vertical rhythm for pages: consistent max width + gutters. */
export function Container({ className, children, size = "default" }: { className?: string; children: React.ReactNode; size?: "default" | "narrow" | "wide" }) {
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", size === "narrow" ? "max-w-3xl" : size === "wide" ? "max-w-7xl" : "max-w-6xl", className)}>{children}</div>;
}

export function Section({ className, children, id }: { className?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={cn("py-12 sm:py-16 lg:py-20", className)}>
      {children}
    </section>
  );
}
