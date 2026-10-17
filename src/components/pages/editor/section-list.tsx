"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BLOCK_LABELS, type Block } from "@/modules/pages/domain/page-schema";

/**
 * Ordered list of sections. Reordering works three ways: up/down buttons
 * (keyboard friendly), pointer drag on the handle, and the hero is pinned
 * first. Every control has a label naming the section.
 */
export function SectionList({
  blocks,
  selectedId,
  onSelect,
  onMove,
  onToggleHidden,
  onRemove,
}: {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onToggleHidden: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const indexFromPointer = (clientY: number): number | null => {
    const items = listRef.current?.querySelectorAll<HTMLLIElement>("li[data-index]");
    if (!items) return null;
    let target: number | null = null;
    items.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) target = Number(el.dataset.index);
    });
    return target;
  };

  const label = (b: Block) => ("heading" in b.props && b.props.heading ? b.props.heading : b.type === "hero" ? b.props.title : b.type === "cta_quote" ? b.props.title : BLOCK_LABELS[b.type].label);

  return (
    <ul ref={listRef} className="space-y-1" aria-label="Sections de la page">
      {blocks.map((b, i) => {
        const pinned = b.type === "hero";
        const selected = b.id === selectedId;
        return (
          <li
            key={b.id}
            data-index={i}
            className={cn(
              "group flex items-center gap-1 rounded-lg border bg-card pr-1 text-sm transition-colors",
              selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:bg-muted/60",
              drag?.over === i && drag.from !== i && "border-dashed border-primary",
              b.hidden && "opacity-60",
            )}
          >
            <button
              type="button"
              aria-label={`Déplacer la section ${label(b)} (glisser)`}
              disabled={pinned}
              className={cn("cursor-grab touch-none p-2 text-muted-foreground disabled:cursor-default disabled:opacity-30", drag?.from === i && "cursor-grabbing")}
              onPointerDown={(e) => {
                if (pinned) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                setDrag({ from: i, over: i });
              }}
              onPointerMove={(e) => {
                if (!drag) return;
                const over = indexFromPointer(e.clientY);
                if (over !== null && over !== drag.over) setDrag({ ...drag, over });
              }}
              onPointerUp={() => {
                if (drag && drag.over !== null && drag.over !== drag.from && drag.over !== 0) onMove(drag.from, drag.over);
                setDrag(null);
              }}
              onPointerCancel={() => setDrag(null)}
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => onSelect(b.id)} aria-current={selected ? "true" : undefined} className="flex min-w-0 flex-1 flex-col items-start py-2 text-left" data-testid={`section-${b.type}`}>
              <span className="w-full truncate font-medium">{label(b)}</span>
              <span className="text-xs text-muted-foreground">
                {BLOCK_LABELS[b.type].label}
                {b.hidden ? " · masquée" : ""}
              </span>
            </button>
            {!pinned && (
              <>
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Monter ${label(b)}`} disabled={i <= 1} onClick={() => onMove(i, i - 1)}>
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Descendre ${label(b)}`} disabled={i >= blocks.length - 1} onClick={() => onMove(i, i + 1)}>
                  <ArrowDown aria-hidden="true" />
                </Button>
              </>
            )}
            <Button type="button" variant="ghost" size="icon-xs" aria-pressed={!b.hidden} aria-label={b.hidden ? `Afficher ${label(b)}` : `Masquer ${label(b)}`} onClick={() => onToggleHidden(b.id)}>
              {b.hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
            {!pinned && (
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Supprimer ${label(b)}`} className="text-muted-foreground hover:text-destructive" onClick={() => onRemove(b.id)}>
                <Trash2 aria-hidden="true" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
