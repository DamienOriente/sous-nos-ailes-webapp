import { cn } from "@/lib/utils";
import { BLOCK_LABELS, type Block } from "@/modules/pages/domain/page-schema";
import { anchorOf } from "./shared";

/**
 * In-page navigation built from the visible sections. Server-rendered plain
 * anchors: no JavaScript, works with the keyboard and the browser's scroll.
 * Templates choose the style (`sticky` strip, `side` column, `inline`).
 */
export function AnchorNav({ blocks, style = "sticky", className, label }: { blocks: Block[]; style?: "sticky" | "side" | "inline" | "pills"; className?: string; label?: string }) {
  const items = blocks.filter((b) => b.type !== "hero" && b.type !== "cta_quote" && b.type !== "social");
  if (items.length < 3) return null;
  const linkLabel = (b: Block) => ("heading" in b.props && b.props.heading ? b.props.heading : BLOCK_LABELS[b.type].label);

  if (style === "side") {
    return (
      <nav aria-label={label ?? "Sections de la page"} className={cn("text-sm", className)}>
        <ul className="space-y-2 border-l border-(--pg-border)">
          {items.map((b) => (
            <li key={b.id}>
              <a href={`#${anchorOf(b)}`} className="-ml-px block border-l-2 border-transparent pl-4 text-(--pg-muted) hover:border-(--pg-accent) hover:text-(--pg-text)">
                {linkLabel(b)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }
  if (style === "pills") {
    return (
      <nav aria-label={label ?? "Sections de la page"} className={cn("pg-scroll-x", className)}>
        <ul className="flex gap-2">
          {items.map((b) => (
            <li key={b.id}>
              <a href={`#${anchorOf(b)}`} className="inline-flex whitespace-nowrap rounded-full border border-(--pg-border) bg-(--pg-surface) px-3.5 py-1.5 text-sm hover:border-(--pg-accent) hover:text-(--pg-accent)">
                {linkLabel(b)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }
  if (style === "inline") {
    return (
      <nav aria-label={label ?? "Sections de la page"} className={cn("pg-scroll-x text-sm", className)}>
        <ul className="flex gap-6">
          {items.map((b) => (
            <li key={b.id}>
              <a href={`#${anchorOf(b)}`} className="whitespace-nowrap text-(--pg-muted) underline-offset-6 hover:text-(--pg-text) hover:underline">
                {linkLabel(b)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }
  return (
    <nav aria-label={label ?? "Sections de la page"} className={cn("sticky top-0 z-20 border-b border-(--pg-border) bg-(--pg-bg)/85 backdrop-blur", className)}>
      <div className="pg-scroll-x mx-auto max-w-7xl px-5 sm:px-8">
        <ul className="flex gap-6 text-sm">
          {items.map((b) => (
            <li key={b.id}>
              <a href={`#${anchorOf(b)}`} className="block whitespace-nowrap border-b-2 border-transparent py-3 text-(--pg-muted) hover:border-(--pg-accent) hover:text-(--pg-text)">
                {linkLabel(b)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
