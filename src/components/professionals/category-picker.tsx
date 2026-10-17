"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { CategoryIcon } from "@/components/professionals/category-icons";
import { cn } from "@/lib/utils";

export type CategoryOption = { id: string; slug: string; name: string; group: string; description: string | null; isChildcare: boolean; icon: string };

/**
 * Primary category as a radio grid grouped by family (childcare first), plus
 * secondary categories as checkboxes. When `syncQuery` is set the page is
 * reloaded with `?category=<id>` so the server can render the matching trade form.
 */
export function CategoryPicker({ categories, groups, primaryId, secondaryIds, syncQuery = false }: { categories: CategoryOption[]; groups: string[]; primaryId: string | null; secondaryIds: string[]; syncQuery?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-medium">
          Métier principal <span aria-hidden="true">*</span>
        </legend>
        <div className="space-y-5">
          {groups.map((g) => {
            const items = categories.filter((c) => c.group === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{g}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((c) => {
                    return (
                      <label key={c.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring")}>
                        <input
                          type="radio"
                          name="primaryCategoryId"
                          value={c.id}
                          defaultChecked={primaryId === c.id}
                          required
                          className="sr-only"
                          onChange={() => {
                            if (!syncQuery) return;
                            const next = new URLSearchParams(params.toString());
                            next.set("category", c.id);
                            router.replace(`?${next.toString()}`, { scroll: false });
                          }}
                        />
                        <CategoryIcon icon={c.icon} className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>
                          <span className="block text-sm font-medium">{c.name}</span>
                          {c.description && <span className="block text-xs text-muted-foreground">{c.description}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Métiers secondaires (facultatif, 4 max)</legend>
        <p className="mb-3 text-xs text-muted-foreground">Vous apparaîtrez aussi dans ces catégories de l'annuaire.</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.id} className="cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary">
              <input type="checkbox" name="secondaryCategoryIds" value={c.id} defaultChecked={secondaryIds.includes(c.id)} className="sr-only" />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
