import { cn } from "@/lib/cn";

export type Tone = "neutral" | "sage" | "clay" | "warning" | "danger" | "info";

const tones: Record<Tone, { dot: string; text: string; ring: string }> = {
  neutral: { dot: "bg-ink-300", text: "text-ink-700", ring: "border-ivory-400" },
  sage: { dot: "bg-sage-600", text: "text-sage-800", ring: "border-sage-200" },
  clay: { dot: "bg-clay-500", text: "text-clay-800", ring: "border-clay-200" },
  warning: { dot: "bg-warning-600", text: "text-warning-600", ring: "border-warning-100" },
  danger: { dot: "bg-danger-600", text: "text-danger-600", ring: "border-danger-100" },
  info: { dot: "bg-info-600", text: "text-info-600", ring: "border-info-100" },
};

/** Status is carried by a dot, the text and the weight, never by colour alone. */
export function StatusBadge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-ivory-50 py-1 pr-3 pl-2.5 text-[13px] font-semibold leading-none whitespace-nowrap",
        t.ring,
        t.text,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", t.dot)} />
      {children}
    </span>
  );
}
