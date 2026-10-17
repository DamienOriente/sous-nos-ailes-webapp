import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { organizations } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ActionForm } from "@/components/professionals/action-form";
import { CategoryPicker } from "@/components/professionals/category-picker";
import { IdentityFields, PresentationFields } from "@/components/professionals/listing-fields";
import { listingExample } from "@/components/professionals/listing-examples";
import { ProfessionalOnboardingAside } from "@/components/professionals/onboarding-aside";
import type { ListingPreviewData } from "@/components/professionals/listing-preview-card";
import { TemplatePicker } from "@/components/professionals/template-picker";
import { TradeFormFields } from "@/components/professionals/trade-form-fields";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getManagedListing, listActiveCategories, recomputeDerived, type ManagedListing, type ProfessionalRow } from "@/modules/professionals/application/professional-service";
import { CATEGORY_GROUPS } from "@/modules/professionals/domain/categories";
import { SUBMISSION_MIN_SCORE } from "@/modules/professionals/domain/completeness";
import { findDepartmentByCode } from "@/modules/professionals/domain/geo";
import { EVENT_TYPE_OPTIONS, LANGUAGE_OPTIONS, labelFor } from "@/modules/professionals/domain/listing-schema";
import { summarizeTradeDetails } from "@/modules/professionals/domain/trade-forms";
import { step1Action, step2Action, step3Action, step4Action, step5Action } from "./actions";

export const metadata: Metadata = { title: "Créer ma fiche professionnelle" };

const STEPS = ["Métier", "Identité", "Votre activité", "Présentation", "Récapitulatif"] as const;
const EXAMPLE_CATEGORY_SLUG = "garde-enfants-evenementielle";

export default async function ProfessionalOnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor("/onboarding/professionnel");
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : null;
  const exampleActive = sp.exemple === "1";
  let managed: ManagedListing | null = null;
  if (id) {
    try {
      managed = await getManagedListing(actor, id);
    } catch (e) {
      if (isAppError(e) && (e.code === "not_found" || e.code === "forbidden")) notFound();
      throw e;
    }
  }
  const requested = Number(typeof sp.step === "string" ? sp.step : "1");
  const step = managed ? Math.min(5, Math.max(1, Number.isFinite(requested) ? requested : 1)) : 1;
  const categories = await listActiveCategories();

  // Example values are defaults for the current step only; nothing is stored until the step is submitted.
  const example = listingExample(managed?.category.formSchemaKey ?? "childcare");
  const exampleAsListing: Partial<ProfessionalRow> = {
    displayName: example.displayName,
    city: example.city,
    postalCode: example.postalCode,
    interventionRadiusKm: example.interventionRadiusKm,
    tagline: example.tagline,
    description: example.description,
    priceFromCents: example.priceFromEuros * 100,
    priceToCents: example.priceToEuros * 100,
    priceUnit: example.priceUnit,
    languages: example.languages,
    eventTypes: example.eventTypes,
    yearsExperience: example.yearsExperience,
  };
  const stepDefaults: Partial<ProfessionalRow> = exampleActive ? { ...(managed?.listing ?? {}), ...exampleAsListing } : (managed?.listing ?? {});
  const exampleCategoryId = categories.find((c) => c.slug === EXAMPLE_CATEGORY_SLUG)?.id ?? null;
  const exampleHref = id ? `/onboarding/professionnel?id=${id}&step=${step}&exemple=1` : "/onboarding/professionnel?exemple=1";

  const preview: Partial<ListingPreviewData> = {
    ...(managed ? { ...managed.listing, completenessScore: managed.listing.completenessScore } : {}),
    ...(exampleActive && step >= 2 && step <= 4 ? previewFromExample(step, exampleAsListing) : {}),
  };
  const previewCategory = managed ? { slug: managed.category.slug, name: managed.category.name, icon: managed.category.icon, formSchemaKey: managed.category.formSchemaKey } : exampleActive ? categoryBySlug(categories, EXAMPLE_CATEGORY_SLUG) : null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Inscription professionnelle" title={managed?.listing.displayName ? managed.listing.displayName : "Créer ma fiche professionnelle"} description="Cinq étapes, enregistrées au fur et à mesure : vous pouvez reprendre plus tard depuis « Mes fiches pro ». Votre fiche se dessine à droite pendant que vous la remplissez." />
      <Stepper current={step} id={id} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div>
          {step === 1 && (
            <ActionForm action={step1Action} submitLabel="Continuer" footer={<ExitButton show={Boolean(managed)} />}>
              {managed && <input type="hidden" name="id" value={managed.listing.id} />}
              <CategoryPicker
                categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, group: c.group, description: c.description, isChildcare: c.isChildcare, icon: c.icon }))}
                groups={[...CATEGORY_GROUPS]}
                primaryId={managed?.listing.primaryCategoryId ?? (exampleActive ? exampleCategoryId : null)}
                secondaryIds={managed?.secondaryCategories.map((c) => c.id) ?? []}
              />
            </ActionForm>
          )}
          {step === 2 && managed && <Step2 managed={managed} defaults={stepDefaults} exampleActive={exampleActive} organizationType={exampleActive ? example.organizationType : undefined} />}
          {step === 3 && managed && (
            <ActionForm action={step3Action} submitLabel="Continuer" footer={<ExitButton show />}>
              <input type="hidden" name="id" value={managed.listing.id} />
              <TradeFormFields formSchemaKey={managed.category.formSchemaKey} values={exampleActive ? { ...managed.listing.tradeDetails, ...example.tradeDetails } : managed.listing.tradeDetails} />
            </ActionForm>
          )}
          {step === 4 && managed && (
            <ActionForm action={step4Action} submitLabel="Continuer" footer={<ExitButton show />}>
              <input type="hidden" name="id" value={managed.listing.id} />
              <PresentationFields listing={stepDefaults} />
            </ActionForm>
          )}
          {step === 5 && managed && <Step5 managed={managed} />}
        </div>
        <ProfessionalOnboardingAside step={step} listing={preview} category={previewCategory} exampleActive={exampleActive} exampleHref={step >= 2 && step <= 4 ? exampleHref : step === 1 && !managed ? exampleHref : null} className="lg:sticky lg:top-6" />
      </div>
    </div>
  );
}

function categoryBySlug(categories: Awaited<ReturnType<typeof listActiveCategories>>, slug: string) {
  const c = categories.find((x) => x.slug === slug);
  return c ? { slug: c.slug, name: c.name, icon: c.icon, formSchemaKey: c.formSchemaKey } : null;
}

/** Only the fields of the current step come from the example in the preview, so the card shows what this step adds. */
function previewFromExample(step: number, ex: Partial<ProfessionalRow>): Partial<ListingPreviewData> {
  if (step === 2) return { displayName: ex.displayName, city: ex.city, interventionRadiusKm: ex.interventionRadiusKm };
  if (step === 4) return { tagline: ex.tagline, priceFromCents: ex.priceFromCents, priceToCents: ex.priceToCents, priceUnit: ex.priceUnit, languages: ex.languages, eventTypes: ex.eventTypes, yearsExperience: ex.yearsExperience };
  return {};
}

function Stepper({ current, id }: { current: number; id: string | null }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Étapes">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        const inner = (
          <>
            <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", state === "current" ? "bg-primary text-primary-foreground" : state === "done" ? "bg-success/20 text-success" : "bg-muted text-muted-foreground")}>{n}</span>
            <span className={cn("text-sm", state === "current" ? "font-medium" : "text-muted-foreground")}>{label}</span>
          </>
        );
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined}>
            {id && state === "done" ? (
              <Link href={`/onboarding/professionnel?id=${id}&step=${n}`} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 hover:bg-muted">
                {inner}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ExitButton({ show }: { show: boolean }) {
  if (!show) return <span />;
  return (
    <Button type="submit" name="intent" value="exit" variant="ghost">
      Enregistrer et terminer plus tard
    </Button>
  );
}

async function Step2({ managed, defaults, exampleActive, organizationType }: { managed: ManagedListing; defaults: Partial<ProfessionalRow>; exampleActive: boolean; organizationType?: string }) {
  const org = managed.listing.organizationId ? (await db.select().from(organizations).where(eq(organizations.id, managed.listing.organizationId)).limit(1))[0] : undefined;
  return (
    <ActionForm action={step2Action} submitLabel="Continuer" footer={<ExitButton show />}>
      <input type="hidden" name="id" value={managed.listing.id} />
      <IdentityFields listing={defaults} organizationType={organizationType ?? org?.type ?? null} siret={exampleActive ? null : (org?.siret ?? org?.siren ?? null)} />
    </ActionForm>
  );
}

async function Step5({ managed }: { managed: ManagedListing }) {
  const { listing, category, secondaryCategories } = managed;
  const { completeness } = await recomputeDerived(listing.id);
  const dept = listing.department ? findDepartmentByCode(listing.department) : null;
  const trade = summarizeTradeDetails(category.formSchemaKey, listing.tradeDetails);
  const selectedTemplate = typeof listing.tradeDetails.__templateKey === "string" ? listing.tradeDetails.__templateKey : null;
  const canSubmit = completeness.score >= SUBMISSION_MIN_SCORE;
  return (
    <ActionForm action={step5Action} submitLabel={canSubmit ? "Soumettre ma fiche à la validation" : "Compléter avant de soumettre"} pendingLabel="Envoi…" footer={<ExitButton show />}>
      <input type="hidden" name="id" value={listing.id} />
      <div className="space-y-8">
        <section className="rounded-2xl border p-5">
          <h2 className="font-heading text-xl font-semibold">Récapitulatif</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Nom commercial" value={listing.displayName} />
            <Row label="Métier principal" value={category.name} />
            <Row label="Métiers secondaires" value={secondaryCategories.map((c) => c.name).join(", ") || "—"} />
            <Row label="Localisation" value={[listing.city, listing.postalCode, dept?.name].filter(Boolean).join(" · ")} />
            <Row label="Rayon" value={`${listing.interventionRadiusKm} km`} />
            <Row label="Langues" value={listing.languages.map((l) => labelFor(LANGUAGE_OPTIONS, l)).join(", ")} />
            <Row label="Évènements" value={listing.eventTypes.map((l) => labelFor(EVENT_TYPE_OPTIONS, l)).join(", ") || "—"} />
            <Row label="Accroche" value={listing.tagline ?? "—"} />
            {trade.map((t) => (
              <Row key={t.label} label={t.label} value={t.value} />
            ))}
          </dl>
          <p className="mt-4 text-sm">
            Complétude : <strong data-testid="completeness-score">{completeness.score} %</strong>
            {!canSubmit && <span className="text-destructive"> — minimum {SUBMISSION_MIN_SCORE} % pour soumettre.</span>}
          </p>
          {completeness.recommendations.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
              {completeness.recommendations.slice(0, 4).map((r) => (
                <li key={r.key}>{r.label}</li>
              ))}
            </ul>
          )}
        </section>
        <TemplatePicker keys={category.suggestedTemplates} selected={selectedTemplate} />
        <p className="text-xs text-muted-foreground">
          En soumettant, vous confirmez l'exactitude des informations déclarées. Notre équipe relit chaque fiche avant publication ; les vérifications affichées publiquement décrivent précisément ce qui a été contrôlé, rien de plus.
        </p>
      </div>
    </ActionForm>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
