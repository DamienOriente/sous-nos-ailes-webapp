import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CompletenessResult } from "@/modules/professionals/domain/completeness";

/** Explainable completeness: score + the next most valuable actions. */
export function CompletenessCard({ result, baseHref, limit = 5 }: { result: CompletenessResult; baseHref: string; limit?: number }) {
  const recs = result.recommendations.slice(0, limit);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Complétude de la fiche</span>
          <span className="font-heading text-2xl tabular-nums" data-testid="completeness-score">
            {result.score} %
          </span>
        </CardTitle>
        <CardDescription>Une fiche complète est mieux classée dans l'annuaire et inspire davantage confiance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={result.score} aria-label={`Complétude ${result.score} %`} />
        {recs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tout est renseigné.</p>
        ) : (
          <ul className="space-y-2">
            {recs.map((r) => (
              <li key={r.key}>
                <Link href={`${baseHref}/${r.href ?? "fiche"}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-muted">
                  <span>{r.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">+{Math.round((r.weight / 100) * 100)} pts</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
