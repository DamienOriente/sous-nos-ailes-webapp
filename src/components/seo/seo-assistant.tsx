import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Paywall } from "@/components/billing/paywall";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SeoItem, SeoReport } from "@/modules/seo/application/seo-service";

/**
 * SEO/GEO assistant. Two registers, never mixed: "Vérifié" (a fact the
 * platform checked) and "Conseil" (a recommendation), each a plain text label.
 * Free plan: score only, the rest behind the paywall.
 */
function LevelIcon({ level }: { level: SeoItem["level"] }) {
  const cls = "size-4 shrink-0";
  if (level === "ok") return <CheckCircle2 className={cn(cls, "text-success")} aria-label="OK" />;
  if (level === "warn") return <AlertTriangle className={cn(cls, "text-warning-foreground")} aria-label="À améliorer" />;
  if (level === "error") return <XCircle className={cn(cls, "text-destructive")} aria-label="Manquant" />;
  return <Info className={cn(cls, "text-info")} aria-label="Information" />;
}

function KindTag({ kind }: { kind: SeoItem["kind"] }) {
  return kind === "verified" ? <span className="text-xs font-medium text-success">Vérifié par la plateforme</span> : <span className="text-xs font-medium text-muted-foreground">Conseil</span>;
}

function ItemList({ items }: { items: SeoItem[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3 p-3 text-sm">
          <LevelIcon level={it.level} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-pretty">{it.message}</p>
            <div className="flex items-center gap-2">
              <KindTag kind={it.kind} />
              {it.href && (
                <Link href={it.href} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                  Corriger
                </Link>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function SeoScoreCard({ report }: { report: SeoReport }) {
  const missing = report.completeness.recommendations.filter((r) => !r.satisfied);
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Complétude de la page</p>
          <p className="font-heading text-5xl font-semibold tabular-nums" data-testid="seo-score">
            {report.completeness.score}
            <span className="text-2xl text-muted-foreground"> / 100</span>
          </p>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          {report.completeness.satisfiedCount} critères sur {report.completeness.total} remplis. Le score reflète ce qui est renseigné, pas votre position dans les moteurs.
        </p>
      </div>
      <Progress value={report.completeness.score} className="mt-4" aria-label={`Score ${report.completeness.score} sur 100`} />
      {missing.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {missing.slice(0, 6).map((r) => (
            <li key={r.kind} className="flex items-start gap-2 text-sm">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span>
                <span className="text-pretty">{r.message}</span>{" "}
                <span className="text-xs text-muted-foreground">(+{r.weight})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SeoAssistant({ report, unlocked }: { report: SeoReport; unlocked: boolean }) {
  return (
    <div className="space-y-10">
      <SeoScoreCard report={report} />
      {!unlocked ? (
        <Paywall
          feature="seo.assistant"
          audience="professional"
          description="Suggestions de titre et de description, aperçu dans les résultats de recherche, analyse des images, vérification des informations locales et état d'indexation : tout ce qu'il faut pour être trouvé par les organisateurs de votre région."
          backHref={`/app/pro/${report.professionalId}/page`}
          backLabel="Retour à la page"
          preview={
            <div className="space-y-2 p-4 text-sm opacity-70" aria-hidden="true">
              <p className="font-medium">Aperçu Google</p>
              <p className="text-base text-sky-deep">{report.preview.title}</p>
              <p className="text-xs text-muted-foreground">{report.preview.url}</p>
            </div>
          }
        />
      ) : (
        <>
          <Card title="Aperçu dans les résultats de recherche" description="Indicatif : chaque moteur coupe et reformule à sa manière.">
            <div className="rounded-xl border bg-card p-4" data-testid="google-preview">
              <p className="text-xs text-muted-foreground">{report.preview.url}</p>
              <p className="mt-0.5 text-lg text-sky-deep">{report.preview.title}</p>
              <p className="text-sm text-muted-foreground text-pretty">{report.preview.description}</p>
            </div>
          </Card>

          <div className="grid gap-8 lg:grid-cols-2">
            <Card title="Titre de la page">
              <ItemList items={[{ kind: "verified", level: report.title.check.level, message: report.title.check.message, href: `/app/pro/${report.professionalId}/page` }]} />
              <p className="text-sm font-medium">Suggestions (métier + ville + spécialité)</p>
              <ul className="space-y-2">
                {report.title.suggestions.map((s) => (
                  <li key={s} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                    <span>{s}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.length} car.</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Copiez la suggestion qui vous convient dans l'onglet SEO de l'éditeur.</p>
            </Card>
            <Card title="Description">
              <ItemList items={[{ kind: "verified", level: report.description.check.level, message: report.description.check.message, href: `/app/pro/${report.professionalId}/page` }]} />
              <p className="text-sm font-medium">Suggestion générée depuis votre fiche</p>
              <p className="rounded-lg border bg-card px-3 py-2 text-sm text-pretty">{report.description.suggestion}</p>
              <p className="text-xs tabular-nums text-muted-foreground">{report.description.suggestion.length} caractères</p>
            </Card>
          </div>

          <Card title="Informations locales" description="Les recherches « métier + ville » sont la première source de demandes.">
            <ItemList items={report.local} />
          </Card>

          <Card title="Images" description={`${report.images.total} image(s) sur la page · ${report.images.missingAlt} sans description · ${report.images.heavy} lourde(s) (> 600 Ko)`}>
            {report.images.total === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Aucune image. Ajoutez une image principale et au moins trois photos de réalisations.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card text-sm">
                {report.images.items.map((img) => (
                  <li key={`${img.where}-${img.fileId}`} className="flex flex-wrap items-center gap-3 p-3">
                    <span className="w-40 shrink-0 text-muted-foreground">{img.where}</span>
                    <span className={cn("flex-1 truncate", !img.altOk && "italic text-destructive")}>{img.altOk ? img.alt : "Description manquante"}</span>
                    <span className={cn("text-xs tabular-nums", img.heavy ? "text-warning-foreground" : "text-muted-foreground")}>{img.sizeBytes ? `${Math.round(img.sizeBytes / 1024)} Ko` : "poids inconnu"}</span>
                    {img.width && img.height && <span className="text-xs tabular-nums text-muted-foreground">{img.width}×{img.height}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Conseils éditoriaux" description="Pour les moteurs classiques et les assistants de recherche génératifs (GEO).">
            <ItemList items={report.editorial} />
          </Card>

          <Card title="Lisibilité et accessibilité">
            <ItemList items={report.accessibility} />
          </Card>

          <Card title="Indexation">
            <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm" data-testid="indexation-status">
              <LevelIcon level={report.indexation.status === "eligible" ? "ok" : report.indexation.status === "not_published" ? "error" : "info"} />
              <div className="space-y-1">
                <p className="text-pretty">{report.indexation.message}</p>
                <p className="text-xs text-muted-foreground">L'indexation effective n'est pas vérifiable depuis la plateforme : utilisez la Search Console de Google si vous souhaitez la suivre.</p>
                <KindTag kind="verified" />
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
