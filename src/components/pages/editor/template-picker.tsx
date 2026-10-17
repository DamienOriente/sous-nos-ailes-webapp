"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { TemplateThumbnail } from "@/components/pages/template-thumbnail";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TemplateSummary } from "./types";

/**
 * Template gallery inside the builder. Suggested templates for the trade come
 * first; premium ones are shown (never hidden) with a lock and a path to the
 * subscription when the plan does not include them.
 */
export function TemplatePicker({
  templates,
  suggested,
  current,
  canUseAll,
  professionalId,
  onPick,
}: {
  templates: TemplateSummary[];
  suggested: string[];
  current: string;
  canUseAll: boolean;
  professionalId: string;
  onPick: (key: string) => void;
}) {
  const ordered = [...suggested.map((k) => templates.find((t) => t.key === k)).filter((t): t is TemplateSummary => Boolean(t)), ...templates.filter((t) => !suggested.includes(t.key))];
  return (
    <div className="space-y-4">
      {!canUseAll && (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">
            Six templates sont inclus dans votre offre. Les autres font partie de Professionnel Premium.{" "}
            <Link href={`/app/compte/abonnement?audience=professional&feature=templates.all&from=/app/pro/${professionalId}/page`} className="font-medium text-primary underline-offset-4 hover:underline">
              Découvrir
            </Link>
          </p>
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Templates">
        {ordered.map((t) => {
          const locked = !t.isFree && !canUseAll;
          const isCurrent = t.key === current;
          const isSuggested = suggested.includes(t.key);
          return (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => !locked && onPick(t.key)}
                aria-pressed={isCurrent}
                aria-disabled={locked}
                data-testid={`template-${t.key}`}
                className={cn("group w-full rounded-xl border bg-card p-2 text-left transition-colors focus-visible:outline-2", isCurrent ? "border-primary ring-2 ring-primary/20" : "hover:bg-muted/60", locked && "cursor-not-allowed")}
              >
                <TemplateThumbnail templateKey={t.key} className={cn("aspect-[4/3] w-full overflow-hidden rounded-lg border [--thumb-scale:0.22]", locked && "opacity-60")} />
                <div className="mt-2 flex items-start justify-between gap-2 px-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {t.name}
                      {isCurrent && <span className="ml-2 text-xs font-normal text-primary">actuel</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.universe}
                      {isSuggested ? " · conseillé pour votre métier" : ""}
                    </p>
                  </div>
                  {locked ? <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Premium" /> : t.isFree ? <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">Gratuit</span> : null}
                </div>
              </button>
              <div className="mt-1 flex justify-end">
                <Button asChild variant="link" size="xs">
                  <Link href={`/templates/${t.key}`} target="_blank" rel="noopener">
                    Voir en grand
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
