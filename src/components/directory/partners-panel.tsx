import Link from "next/link";
import type { PartnerCard } from "@/modules/professionals/application/recommendation-service";

/** Public page: the professional's recommended partners and who is often booked with them. */
export function PartnersPanel({ displayName, recommended, often }: { displayName: string; recommended: PartnerCard[]; often: (PartnerCard & { events: number })[] }) {
  if (!recommended.length && !often.length) return null;
  return (
    <section aria-labelledby="partners-h" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6" data-testid="partners-panel">
      <h2 id="partners-h" className="text-2xl font-semibold text-balance">
        Le réseau de {displayName}
      </h2>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {recommended.length > 0 && (
          <div>
            <h3 className="font-medium">Partenaires recommandés</h3>
            <ul className="mt-3 divide-y rounded-xl border bg-card">
              {recommended.map((p) => (
                <li key={p.id} className="px-4 py-3 text-sm">
                  <Link href={`/pro/${p.slug}`} className="font-medium hover:underline">
                    {p.displayName}
                  </Link>
                  <span className="text-muted-foreground">
                    , {p.categoryName}
                    {p.city ? `, ${p.city}` : ""}
                  </span>
                  {p.note && <p className="mt-1 text-muted-foreground text-pretty">« {p.note} »</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {often.length > 0 && (
          <div>
            <h3 className="font-medium">Souvent réservé avec</h3>
            <p className="mt-1 text-sm text-muted-foreground">Professionnels confirmés sur les mêmes évènements, au moins deux fois.</p>
            <ul className="mt-3 divide-y rounded-xl border bg-card">
              {often.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    <Link href={`/pro/${p.slug}`} className="font-medium hover:underline">
                      {p.displayName}
                    </Link>
                    <span className="text-muted-foreground">, {p.categoryName}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">{p.events} évènements</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
