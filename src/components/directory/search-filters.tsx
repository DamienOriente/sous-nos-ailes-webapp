import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEPARTMENTS } from "@/modules/professionals/domain/geo";
import { EVENT_TYPE_OPTIONS, LANGUAGE_OPTIONS } from "@/modules/professionals/domain/listing-schema";
import { VERIFICATION_LEVEL_LABELS } from "@/modules/professionals/domain/verification";
import { toQueryString, type SearchFilters } from "@/modules/directory/domain/search-params";

export type CategoryOption = { slug: string; name: string; group: string };

/**
 * Plain GET form: works without JavaScript, every filter is in the URL.
 * `lockedCategory` / `lockedGeo` hide the corresponding controls on category/geo pages.
 */
export function SearchFilters({ filters, categories, action = "/annuaire", lockedCategory = false, lockedGeo = false, signedIn = false }: { filters: SearchFilters; categories: CategoryOption[]; action?: string; lockedCategory?: boolean; lockedGeo?: boolean; signedIn?: boolean }) {
  const groups = [...new Set(categories.map((c) => c.group))];
  const launchDepartments = DEPARTMENTS.filter((d) => d.region === "Occitanie" || d.region === "Nouvelle-Aquitaine");
  const others = DEPARTMENTS.filter((d) => !launchDepartments.includes(d));
  // One-tap refinements: each chip is a plain link that toggles a single filter, so it works without JavaScript.
  const chip = (patch: Partial<SearchFilters>) => `${action}${toQueryString({ ...filters, page: 1, ...patch })}`;
  const quick: Array<{ label: string; active: boolean; href: string }> = [
    { label: "Enfants bienvenus", active: filters.children === "1", href: chip({ children: filters.children === "1" ? "" : "1" }) },
    { label: "Justificatifs examinés", active: filters.verification >= 3, href: chip({ verification: filters.verification >= 3 ? 0 : 3 }) },
    { label: "Mariage", active: filters.eventType === "wedding", href: chip({ eventType: filters.eventType === "wedding" ? "" : "wedding" }) },
    { label: "Séminaire", active: filters.eventType === "seminar", href: chip({ eventType: filters.eventType === "seminar" ? "" : "seminar" }) },
  ];
  return (
    <form method="get" action={action} className="space-y-4 rounded-3xl border bg-card p-4 sm:p-6" role="search" aria-label="Rechercher un professionnel">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" name="q" defaultValue={filters.q} placeholder="Garde d'enfants, DJ, traiteur, nom d'un professionnel…" className="pl-9" aria-label="Recherche" />
        </div>
        {!lockedCategory && (
          <select name="category" defaultValue={filters.category} className="h-9 rounded-lg border bg-background px-3 text-sm sm:w-64" aria-label="Métier">
            <option value="">Tous les métiers</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {categories
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        )}
        {!lockedGeo && (
          <select name="department" defaultValue={filters.department} className="h-9 rounded-lg border bg-background px-3 text-sm sm:w-56" aria-label="Département">
            <option value="">Toute la France</option>
            <optgroup label="Occitanie & Nouvelle-Aquitaine">
              {launchDepartments.map((d) => (
                <option key={d.code} value={d.slug}>
                  {d.name} ({d.code})
                </option>
              ))}
            </optgroup>
            <optgroup label="Autres départements">
              {others.map((d) => (
                <option key={d.code} value={d.slug}>
                  {d.name} ({d.code})
                </option>
              ))}
            </optgroup>
          </select>
        )}
        <Button type="submit">Rechercher</Button>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Filtres rapides">
        {quick.map((q) => (
          <li key={q.label}>
            <Link href={q.href} aria-current={q.active ? "true" : undefined} className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${q.active ? "border-primary bg-sage-soft text-sage-deep dark:text-foreground" : "hover:bg-muted"}`}>
              {q.label}
            </Link>
          </li>
        ))}
      </ul>
      <details className="group" open={Boolean(filters.city || filters.radius || filters.eventType || filters.priceMax || filters.children || filters.languages || filters.verification || filters.date || filters.favorites)}>
        <summary className="inline-flex cursor-pointer items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          Plus de critères
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {!lockedGeo && (
            <div className="space-y-1.5">
              <Label htmlFor="f-city">Ville</Label>
              <Input id="f-city" name="city" defaultValue={filters.city} placeholder="Toulouse" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="f-radius">Rayon (km)</Label>
            <Input id="f-radius" name="radius" type="number" min={0} max={300} step={10} defaultValue={filters.radius || ""} placeholder="ex. 50" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-date">Disponible le</Label>
            <Input id="f-date" name="date" type="date" defaultValue={filters.date} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-event">Type d'évènement</Label>
            <select id="f-event" name="eventType" defaultValue={filters.eventType} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">Tous</option>
              {EVENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-pmin">Budget min (€)</Label>
            <Input id="f-pmin" name="priceMin" type="number" min={0} defaultValue={filters.priceMin || ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-pmax">Budget max (€)</Label>
            <Input id="f-pmax" name="priceMax" type="number" min={0} defaultValue={filters.priceMax || ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-lang">Langue</Label>
            <select id="f-lang" name="languages" defaultValue={filters.languages} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">Toutes</option>
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-verif">Vérification minimale</Label>
            <select id="f-verif" name="verification" defaultValue={String(filters.verification)} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
              {[0, 1, 2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>
                  {l === 0 ? "Indifférent" : VERIFICATION_LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="children" value="1" defaultChecked={filters.children === "1"} className="size-4 rounded border" />
            Accepte / prend en charge les enfants
          </label>
          {signedIn && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="favorites" value="1" defaultChecked={filters.favorites === "1"} className="size-4 rounded border" />
              Mes favoris uniquement
            </label>
          )}
        </div>
      </details>
    </form>
  );
}
