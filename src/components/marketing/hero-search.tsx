"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SearchCategory = { slug: string; name: string; isChildcare: boolean };

/**
 * Hero search: trade + city → /annuaire/<slug>?city=. Childcare is preselected
 * because it is what the platform is known for; everything else is one tap away.
 */
export function HeroSearch({ categories, defaultSlug }: { categories: SearchCategory[]; defaultSlug: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState(defaultSlug);
  const [city, setCity] = useState("");
  const childcare = categories.filter((c) => c.isChildcare);
  const others = categories.filter((c) => !c.isChildcare);

  return (
    <form
      role="search"
      aria-label="Rechercher un professionnel"
      className="flex flex-col gap-2 rounded-3xl border bg-card p-2 sm:flex-row sm:items-stretch sm:rounded-full"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        const trimmed = city.trim();
        if (trimmed) params.set("city", trimmed);
        const qs = params.toString();
        router.push(`/annuaire/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`);
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col px-3 py-1.5 sm:border-r">
        <label htmlFor="hero-trade" className="text-xs font-medium text-muted-foreground">
          Quel professionnel ?
        </label>
        <select
          id="hero-trade"
          name="trade"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="h-8 w-full appearance-none bg-transparent text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md"
        >
          <optgroup label="Enfants">
            {childcare.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Autres métiers">
            {others.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-3 py-1.5">
        <label htmlFor="hero-city" className="text-xs font-medium text-muted-foreground">
          Où ?
        </label>
        <input
          id="hero-city"
          name="city"
          type="text"
          autoComplete="address-level2"
          placeholder="Ville ou département"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="h-8 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md"
        />
      </div>
      <Button type="submit" size="lg" className="h-auto rounded-full px-5 py-3 sm:self-stretch">
        <Search className="size-4" aria-hidden="true" />
        Chercher
      </Button>
    </form>
  );
}
