import { cn, formatEuros } from "@/lib/utils";
import { tierRanges, type PriceTier } from "@/modules/billing/domain/tiered-pricing";

function rangeLabel(from: number, to: number | null): string {
  if (to === null) return `${from}e fiche et suivantes`;
  if (from === to) return `${from}e fiche`;
  return `De la ${from}e à la ${to}e fiche`;
}

/** Agency price list: one row per tier, the first listing being included. */
export function AgencyTiers({ tiers, className }: { tiers: PriceTier[]; className?: string }) {
  if (!tiers.length) return null;
  return (
    <table className={cn("w-full text-sm", className)}>
      <caption className="sr-only">Prix mensuel de chaque fiche supplémentaire</caption>
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th scope="col" className="py-2 font-medium">Fiches</th>
          <th scope="col" className="py-2 text-right font-medium">Prix par fiche et par mois</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b">
          <td className="py-2">1re fiche</td>
          <td className="py-2 text-right tabular-nums">Incluse</td>
        </tr>
        {tierRanges(tiers).map((r) => (
          <tr key={r.from} className="border-b last:border-0">
            <td className="py-2">{rangeLabel(r.from, r.to)}</td>
            <td className="py-2 text-right tabular-nums">{formatEuros(r.unitAmountCents)} TTC</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
