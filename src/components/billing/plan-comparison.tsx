import { Check, Minus, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatEuros } from "@/lib/utils";
import { FEATURES, type FeatureKey } from "@/modules/billing/domain/plans";
import type { PlanWithFeatures } from "@/modules/billing/application/subscription-service";

/** Features grouped by what they do for the reader (order = display order). */
const GROUPS: Array<{ title: string; keys: FeatureKey[] }> = [
  { title: "Préparer", keys: ["events.create", "directory.search", "favorites", "tasks", "timeline.basic", "contacts", "inquiries.send"] },
  { title: "Inviter et placer", keys: ["invitations.basic", "invitations.premium", "seating_plan"] },
  { title: "Piloter", keys: ["dashboard.basic", "dashboard.advanced", "budget.advanced", "exports.advanced", "collaboration.extended", "templates.premium"] },
  { title: "Votre page", keys: ["listing", "templates.free", "templates.all", "customization.advanced", "seo.assistant", "sponsored.eligible"] },
  { title: "Votre activité", keys: ["inquiries.receive", "calendar.internal", "calendar.sync", "tools.premium", "stats", "crm.advanced"] },
];

/** One-line meaning of each feature, in the reader's words. */
const MEANING: Partial<Record<FeatureKey, string>> = {
  "events.create": "Un espace par évènement, partagé avec vos coorganisateurs",
  "directory.search": "Professionnels vérifiés, filtrés par métier et distance",
  favorites: "Gardez vos coups de cœur sous la main",
  tasks: "Liste de tâches adaptée au type d'évènement",
  "timeline.basic": "Déroulé du jour J partagé avec les prestataires",
  contacts: "Carnet de contacts et import CSV",
  "inquiries.send": "Demandes de devis centralisées",
  "invitations.basic": "Lien d'invitation et réponses des invités",
  "invitations.premium": "Invitations à vos couleurs et QR codes d'accès",
  seating_plan: "Éditeur visuel, capacité vérifiée, export PDF",
  "dashboard.basic": "L'essentiel : réponses, budget, prochaines étapes",
  "dashboard.advanced": "Courbes, échéances calculées, exports",
  "budget.advanced": "Prévu / engagé / payé par poste",
  "exports.advanced": "PDF et CSV pour vos prestataires",
  "collaboration.extended": "Coorganisateurs illimités, droits fins",
  "templates.premium": "Modèles d'invitation premium",
  listing: "Votre fiche dans l'annuaire, modérée",
  "templates.free": "Trois modèles de page par métier",
  "templates.all": "Les 21 modèles, tous métiers",
  "customization.advanced": "Couleurs, polices, blocs sur mesure",
  "seo.assistant": "Recommandations et aperçu Google indicatif",
  "sponsored.eligible": "Mise en avant dans l'annuaire",
  "inquiries.receive": "Demandes qualifiées (date, lieu, âges)",
  "calendar.internal": "Agenda et disponibilités",
  "calendar.sync": "Google Agenda et Outlook synchronisés",
  "tools.premium": "Outils métier avancés",
  stats: "Vues, demandes, conversion",
  "crm.advanced": "Suivi des devis et relances",
};

/**
 * Side-by-side plans of one audience with a feature matrix grouped by use.
 * `highlightFeature` is the feature that triggered a paywall; `renderCta(plan)`
 * lets the caller decide what the button does (subscribe form, sign-in link…).
 */
export function PlanComparison({
  plans,
  currentPlanKey,
  highlightFeature,
  renderCta,
}: {
  plans: PlanWithFeatures[];
  currentPlanKey?: string | null;
  highlightFeature?: FeatureKey | null;
  renderCta?: (plan: PlanWithFeatures) => React.ReactNode;
}) {
  const featureKeys = new Set(plans.flatMap((p) => p.features.filter((f) => f.enabled).map((f) => f.key)));
  const grouped = GROUPS.map((g) => ({ ...g, keys: g.keys.filter((k) => featureKeys.has(k)) })).filter((g) => g.keys.length > 0);
  const leftovers = (Object.keys(FEATURES) as FeatureKey[]).filter((k) => featureKeys.has(k) && !GROUPS.some((g) => g.keys.includes(k)));
  if (leftovers.length) grouped.push({ title: "Autres", keys: leftovers });
  const paidPlan = plans.find((p) => p.priceMonthlyCents > 0);
  const freePlan = plans.find((p) => p.priceMonthlyCents === 0);
  const extras = paidPlan && freePlan ? paidPlan.features.filter((f) => f.enabled && !freePlan.features.some((g) => g.key === f.key && g.enabled)).map((f) => f.key as FeatureKey) : [];

  return (
    <div className="space-y-6">
      <div className={cn("grid gap-4", plans.length > 1 ? "sm:grid-cols-2" : "")}>
        {plans.map((plan) => {
          const current = plan.key === currentPlanKey;
          const paid = plan.priceMonthlyCents > 0;
          return (
            <Card key={plan.id} className={cn("relative gap-4 overflow-hidden p-6", paid && "border-primary/40 shadow-soft")} data-plan={plan.key}>
              {paid && <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-accent/70" aria-hidden="true" />}
              <div className="relative space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {paid && <Sparkles className="size-4 text-primary" aria-hidden="true" />}
                  <h3 className="font-heading text-xl font-semibold">{plan.name}</h3>
                  {current && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Votre offre actuelle</span>}
                </div>
                <p className="text-sm text-muted-foreground text-pretty">{plan.description}</p>
              </div>
              <p className="relative font-heading text-3xl font-semibold">
                {paid ? formatEuros(plan.priceMonthlyCents) : "0 €"}
                <span className="text-sm font-normal text-muted-foreground"> TTC / mois{paid ? ", sans engagement" : ""}</span>
              </p>
              {paid && extras.length > 0 && (
                <ul className="relative grid gap-1.5 text-sm sm:grid-cols-2">
                  {extras.slice(0, 6).map((k) => (
                    <li key={k} className={cn("flex items-start gap-1.5", k === highlightFeature && "font-medium text-primary")}>
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                      {FEATURES[k]}
                    </li>
                  ))}
                </ul>
              )}
              {renderCta ? <div className="relative">{renderCta(plan)}</div> : null}
            </Card>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Comparatif des fonctionnalités par offre</caption>
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th scope="col" className="px-4 py-3 font-medium">
                Fonctionnalité
              </th>
              {plans.map((p) => (
                <th key={p.id} scope="col" className="w-36 px-4 py-3 text-center font-medium">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          {grouped.map((g) => (
            <tbody key={g.title}>
              <tr className="border-b bg-muted/20">
                <th scope="rowgroup" colSpan={plans.length + 1} className="px-4 py-2 text-left font-heading text-sm font-semibold text-muted-foreground">
                  {g.title}
                </th>
              </tr>
              {g.keys.map((key) => {
                const highlighted = key === highlightFeature;
                return (
                  <tr key={key} className={cn("border-b last:border-0", highlighted && "bg-accent/60")} data-feature={key}>
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{FEATURES[key]}</span>
                        {highlighted && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Ce qui vous intéresse</span>}
                      </span>
                      {MEANING[key] && <span className="block text-xs text-muted-foreground">{MEANING[key]}</span>}
                    </th>
                    {plans.map((p) => {
                      const f = p.features.find((x) => x.key === key);
                      return (
                        <td key={p.id} className="px-4 py-2.5 text-center">
                          {f?.enabled ? (
                            <span className="inline-flex items-center gap-1 text-success">
                              <Check className="size-4" aria-hidden="true" />
                              <span className={f.limit !== null ? "text-foreground" : "sr-only"}>{f.limit !== null ? `jusqu'à ${f.limit}` : "Inclus"}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              <Minus className="inline size-4" aria-hidden="true" />
                              <span className="sr-only">Non inclus</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
