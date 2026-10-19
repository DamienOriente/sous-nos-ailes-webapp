import { cn } from "@/lib/utils";
import type { FeatureKey } from "@/modules/billing/domain/plans";

/**
 * Static miniatures of the premium tools, rendered with real React markup
 * (no screenshots): what the organiser or professional gets after
 * subscribing. Every figure is fictitious and tied to the demo scenario
 * (wedding of Louis and Lisa, demo professional pages); the surrounding
 * paywall labels them as examples.
 */
const INERT = "@container pointer-events-none select-none";

const SEATS = [
  { name: "Table des mariés", seats: 8, kids: 0, x: 44, y: 28 },
  { name: "Famille Dupont", seats: 10, kids: 2, x: 16, y: 62 },
  { name: "Amis de Lisa", seats: 10, kids: 0, x: 46, y: 70 },
  { name: "Collègues", seats: 10, kids: 0, x: 74, y: 60 },
  { name: "Cousins", seats: 10, kids: 3, x: 80, y: 24 },
] as const;

export function SeatingPlanPreview({ className }: { className?: string }) {
  return (
    <figure className={cn("grid gap-0 @lg:grid-cols-[1fr_11rem]", INERT, className)} aria-label="Exemple de plan de table : cinq tables rondes et le coin enfants">
      <div className="relative aspect-[16/10] bg-card">
        <div className="absolute left-[4%] top-[8%] flex h-[14%] w-[26%] items-center justify-center rounded-md bg-sky/60 text-[10px] font-medium text-foreground">Piste de danse</div>
        <div className="absolute bottom-[8%] left-[4%] flex h-[16%] w-[22%] items-center justify-center rounded-md border-2 border-dashed border-blush-deep/70 bg-blush/50 text-[10px] font-medium text-foreground">Coin enfants</div>
        {SEATS.map((t) => (
          <div key={t.name} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${t.x}%`, top: `${t.y}%` }}>
            <div className={cn("relative flex size-14 items-center justify-center rounded-full border-2 text-[10px] font-semibold tabular-nums", t.kids ? "border-blush-deep bg-blush/60" : "border-sage bg-sage-soft")}>
              {t.seats}
              {Array.from({ length: t.seats }).map((_, i) => (
                <span key={i} className="absolute size-2 rounded-full bg-sage-deep" style={{ transform: `rotate(${(360 / t.seats) * i}deg) translateY(-34px)` }} />
              ))}
            </div>
            <p className="mt-1 w-20 -translate-x-3 text-center text-[9px] leading-tight text-muted-foreground">{t.name}</p>
          </div>
        ))}
      </div>
      <figcaption className="min-w-0 space-y-2 border-t bg-muted/40 p-3 text-xs @lg:border-l @lg:border-t-0">
        <p className="font-medium">Mariage de Louis et Lisa</p>
        <dl className="space-y-1 text-muted-foreground">
          <div className="flex justify-between"><dt>Invités placés</dt><dd className="text-foreground tabular-nums">86 / 90</dd></div>
          <div className="flex justify-between"><dt>Enfants au coin jeux</dt><dd className="text-foreground tabular-nums">5</dd></div>
          <div className="flex justify-between"><dt>Capacité restante</dt><dd className="text-foreground tabular-nums">4 places</dd></div>
        </dl>
        <p className="rounded-md bg-card px-2 py-1 text-[11px]">Export PDF prêt pour l'imprimeur</p>
      </figcaption>
    </figure>
  );
}

export function QrInvitationPreview({ className }: { className?: string }) {
  return (
    <figure className={cn("grid gap-0 bg-card @lg:grid-cols-2", INERT, className)} aria-label="Exemple d'invitation personnalisée avec QR code">
      <div className="relative m-4 overflow-hidden rounded-xl border bg-ivory p-5 shadow-soft dark:bg-card">
        <p className="font-heading text-xs text-muted-foreground">Vous êtes invités au</p>
        <p className="font-heading text-xl leading-tight">Mariage de Louis &amp; Lisa</p>
        <p className="mt-2 text-xs text-muted-foreground">Samedi 12 juin 2027 · 15 h · Domaine d'Hélène, Lavaur</p>
        <div className="mt-4 flex items-end justify-between">
          <div className="text-[10px] leading-snug text-muted-foreground">
            <p className="font-medium text-foreground">Famille Dupont</p>
            <p>4 personnes, dont 2 enfants</p>
            <p>Garde d'enfants sur place</p>
          </div>
          <div className="grid size-14 grid-cols-7 gap-px rounded bg-foreground p-1" aria-hidden="true">
            {Array.from({ length: 49 }).map((_, i) => (
              <span key={i} className={cn("block", (i * 7 + 3) % 5 === 0 || i % 9 === 0 || i < 7 || i % 7 === 0 ? "bg-foreground" : "bg-background")} />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-2 border-t p-4 text-xs @lg:border-l @lg:border-t-0">
        <p className="font-medium">Réponses en direct</p>
        <ul className="space-y-1.5">
          {[
            ["Famille Dupont", "Vient · 4 pers.", "success"],
            ["Nora & Sami", "Vient · 2 pers.", "success"],
            ["Tante Odile", "En attente", "neutral"],
            ["Collègues de Louis", "Décline · 1", "warning"],
          ].map(([who, state, tone]) => (
            <li key={who} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1">
              <span>{who}</span>
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", tone === "success" && "bg-success/15 text-sage-deep dark:text-success", tone === "warning" && "bg-warning/20 text-warning-foreground", tone === "neutral" && "bg-muted text-muted-foreground")}>{state}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">Le QR code sert au contrôle d'accès le jour J.</p>
      </div>
    </figure>
  );
}

const WEEKS = [12, 18, 16, 25, 31, 28, 40, 36];

export function AdvancedDashboardPreview({ className, audience = "organizer" }: { className?: string; audience?: "organizer" | "professional" }) {
  const max = Math.max(...WEEKS);
  const pro = audience === "professional";
  return (
    <figure className={cn("grid gap-0 bg-card @lg:grid-cols-[1fr_12rem]", INERT, className)} aria-label={pro ? "Exemple de statistiques d'une page professionnelle" : "Exemple de tableau de bord avancé d'un évènement"}>
      <div className="space-y-3 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium">{pro ? "Vues de votre page, 8 dernières semaines" : "Réponses reçues, 8 dernières semaines"}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{pro ? "340 vues" : "206 réponses"}</p>
        </div>
        <div className="flex h-24 items-end gap-1.5" aria-hidden="true">
          {WEEKS.map((v, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-primary/70" style={{ height: `${(v / max) * 100}%` }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {(pro ? [["Demandes", "11"], ["Conversion", "3,2 %"], ["Favoris", "27"]] : [["Taux de réponse", "78 %"], ["Enfants annoncés", "12"], ["Budget engagé", "55 %"]]).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-muted/50 px-2 py-1.5">
              <p className="text-muted-foreground">{k}</p>
              <p className="font-heading text-base font-semibold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2 border-t p-4 text-xs @lg:border-l @lg:border-t-0">
        <p className="font-medium">{pro ? "Origine des demandes" : "Prochaines échéances"}</p>
        <ul className="space-y-1.5 text-muted-foreground">
          {(pro ? ["Annuaire · 6", "Page publique · 4", "Recommandation · 1"] : ["Relancer 20 invités · J-45", "Finaliser le plan de table · J-14", "Confirmer la garde d'enfants · J-7"]).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function SeoPreview({ className }: { className?: string }) {
  return (
    <figure className={cn("space-y-3 bg-card p-4", INERT, className)} aria-label="Exemple de recommandations SEO et d'aperçu Google indicatif">
      <div className="rounded-lg border bg-background p-3">
        <p className="text-[11px] text-muted-foreground">sousnosailes.fr › pro › marie-delcourt-garde-enfants</p>
        <p className="font-medium text-sky-deep">Marie Delcourt, garde d'enfants évènementielle à Toulouse</p>
        <p className="text-xs text-muted-foreground">Garde d'enfants pour mariages, baptêmes et séminaires, à Toulouse et en Occitanie.</p>
      </div>
      <ul className="grid gap-1.5 text-xs @md:grid-cols-2">
        {[
          ["Titre avec la ville", "Fait"],
          ["Description de 200 caractères", "À compléter"],
          ["Photos avec texte alternatif", "6 / 8"],
          ["Tarifs indicatifs renseignés", "Fait"],
        ].map(([k, v]) => (
          <li key={k} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5">
            <span>{k}</span>
            <span className={cn("font-medium", v === "Fait" ? "text-success" : "text-warning-foreground")}>{v}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function CalendarSyncPreview({ className }: { className?: string }) {
  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  const busy = new Set([5, 6, 12, 13, 19, 26, 27]);
  const synced = new Set([6, 13, 26]);
  return (
    <figure className={cn("grid gap-0 bg-card @lg:grid-cols-[1fr_11rem]", INERT, className)} aria-label="Exemple de calendrier synchronisé avec Google et Outlook">
      <div className="p-4">
        <p className="mb-2 text-xs font-medium">Juin 2027</p>
        <div className="grid grid-cols-7 gap-1" aria-hidden="true">
          {days.map((d) => (
            <div key={d} className={cn("flex aspect-square items-center justify-center rounded-md text-[10px] tabular-nums", busy.has(d) ? "bg-primary/15 font-medium text-primary" : "bg-muted/50 text-muted-foreground", synced.has(d) && "ring-1 ring-sky-deep")}>
              {d}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2 border-t p-4 text-xs @lg:border-l @lg:border-t-0">
        <p className="font-medium">Sources</p>
        <ul className="space-y-1.5 text-muted-foreground">
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Sous Nos Ailes · 4 prestations</li>
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full ring-1 ring-sky-deep" /> Google Agenda · 3 indisponibilités</li>
        </ul>
        <p className="text-muted-foreground">Dernière synchronisation il y a 4 min. Les conflits apparaissent avant d'accepter une demande.</p>
      </div>
    </figure>
  );
}

export function TemplatesPreview({ className }: { className?: string }) {
  const swatches = [
    ["Éditorial luxe", "bg-foreground/70"],
    ["Nuit électrique", "bg-sky-deep"],
    ["Jardin fleuri", "bg-sage-soft"],
    ["Galerie noire", "bg-foreground"],
    ["Table gourmande", "bg-gold/70"],
    ["Panorama photo", "bg-sky/60"],
  ];
  return (
    <figure className={cn("grid grid-cols-3 gap-3 bg-card p-4", INERT, className)} aria-label="Exemple de la bibliothèque complète de modèles de page">
      {swatches.map(([name, fill]) => (
        <div key={name} className="overflow-hidden rounded-lg border">
          <div className={cn("h-14", fill)}>
            <div className="m-2 h-2 w-1/2 rounded bg-background/70" />
            <div className="mx-2 h-1.5 w-1/3 rounded bg-background/50" />
          </div>
          <p className="px-2 py-1 text-[10px] font-medium">{name}</p>
        </div>
      ))}
    </figure>
  );
}

export function BudgetPreview({ className }: { className?: string }) {
  const rows = [
    ["Lieu", 4500, 4500, 2250],
    ["Traiteur", 6000, 5984, 1800],
    ["Garde d'enfants", 900, 840, 0],
    ["Photographe", 1800, 0, 0],
  ] as const;
  return (
    <figure className={cn("bg-card p-4 text-xs", INERT, className)} aria-label="Exemple de budget avancé par poste">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-medium">Budget : 15 000 € prévus</p>
        <p className="text-muted-foreground">Engagé 11 324 € · Payé 4 050 €</p>
      </div>
      <ul className="space-y-1.5">
        {rows.map(([name, planned, committed, paid]) => (
          <li key={name} className="grid grid-cols-[6rem_1fr_4.5rem] items-center gap-2">
            <span>{name}</span>
            <span className="relative h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <span className="absolute inset-y-0 left-0 rounded-full bg-primary/40" style={{ width: `${(committed / planned) * 100}%` }} />
              <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(paid / planned) * 100}%` }} />
            </span>
            <span className="text-right text-muted-foreground tabular-nums">{planned.toLocaleString("fr-FR")} €</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Preview + the three concrete changes brought by the feature. */
export const FEATURE_PREVIEWS: Partial<Record<FeatureKey, { render: (audience: "organizer" | "professional") => React.ReactNode; changes: string[] }>> = {
  seating_plan: { render: () => <SeatingPlanPreview />, changes: ["Éditeur visuel : glissez les invités table par table", "Capacité vérifiée, enfants regroupés près du coin jeux", "Export PDF pour le lieu et l'imprimeur"] },
  "invitations.premium": { render: () => <QrInvitationPreview />, changes: ["Invitations à vos couleurs, lien personnel par foyer", "QR code de contrôle d'accès le jour J", "Réponses et nombre d'enfants mis à jour en direct"] },
  "dashboard.advanced": { render: (a) => <AdvancedDashboardPreview audience={a} />, changes: ["Courbes de réponses et de budget semaine par semaine", "Échéances calculées depuis la date de l'évènement", "Export des chiffres en CSV"] },
  "budget.advanced": { render: () => <BudgetPreview />, changes: ["Prévu, engagé et payé pour chaque poste", "Acomptes et reste à payer calculés automatiquement", "Export comptable PDF / CSV"] },
  "exports.advanced": { render: () => <BudgetPreview />, changes: ["Budget, invités et planning exportés en PDF", "Fichiers CSV pour vos tableurs", "Documents prêts à partager avec vos prestataires"] },
  "templates.premium": { render: () => <TemplatesPreview />, changes: ["Modèles d'invitation et de page premium", "Couleurs et typographies personnalisables", "Changement de modèle sans perdre le contenu"] },
  "collaboration.extended": { render: (a) => <AdvancedDashboardPreview audience={a} />, changes: ["Coorganisateurs illimités", "Droits fins par section (budget, enfants, invités)", "Historique des modifications"] },
  stats: { render: () => <AdvancedDashboardPreview audience="professional" />, changes: ["Vues, demandes et conversion de votre page", "Origine des demandes (annuaire, page, recommandation)", "Comparaison semaine par semaine"] },
  "seo.assistant": { render: () => <SeoPreview />, changes: ["Recommandations concrètes, champ par champ", "Aperçu indicatif de votre résultat Google", "Score de complétude recalculé à chaque modification"] },
  "calendar.sync": { render: () => <CalendarSyncPreview />, changes: ["Google Agenda et Outlook synchronisés dans les deux sens", "Conflits détectés avant d'accepter une demande", "Rappels automatiques avant chaque prestation"] },
  "templates.all": { render: () => <TemplatesPreview />, changes: ["Les 21 modèles de page, tous métiers", "Changement de modèle sans perdre vos contenus", "Palettes et typographies au choix"] },
  "customization.advanced": { render: () => <TemplatesPreview />, changes: ["Couleurs, polices et blocs réorganisables", "Sections sur mesure (FAQ, tarifs, galerie)", "Aperçu mobile et bureau avant publication"] },
  "tools.premium": { render: () => <AdvancedDashboardPreview audience="professional" />, changes: ["Statistiques de votre page", "Assistant SEO", "Gestion commerciale avancée (relances, suivi des devis)"] },
  "crm.advanced": { render: () => <AdvancedDashboardPreview audience="professional" />, changes: ["Suivi des devis : envoyé, relancé, accepté", "Relances programmées", "Historique complet par client"] },
  "sponsored.eligible": { render: () => <SeoPreview />, changes: ["Mise en avant dans l'annuaire de votre département", "Étiquette « sponsorisé » transparente pour les organisateurs", "Statistiques des emplacements"] },
};

export function featurePreview(feature: FeatureKey, audience: "organizer" | "professional"): { node: React.ReactNode; changes: string[] } | null {
  const def = FEATURE_PREVIEWS[feature];
  if (!def) return null;
  return { node: def.render(audience), changes: def.changes };
}
