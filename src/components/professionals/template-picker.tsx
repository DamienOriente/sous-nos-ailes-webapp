import { cn } from "@/lib/utils";

/** Readable names for template keys (the pages module owns the real template definitions). */
const TEMPLATE_LABELS: Record<string, { name: string; hint: string; swatch: string }> = {
  "nid-douillet": { name: "Nid douillet", hint: "Chaleureux, pastel, pensé pour la garde d'enfants.", swatch: "bg-blush/70" },
  "ronde-enfantine": { name: "Ronde enfantine", hint: "Coloré et joueur, pour l'animation jeunesse.", swatch: "bg-sky/70" },
  "sauge-elegante": { name: "Sauge élégante", hint: "Sobre et végétal, le style maison.", swatch: "bg-sage-soft" },
  "minimal-ivoire": { name: "Minimal ivoire", hint: "Épuré, beaucoup d'espace, typographie forte.", swatch: "bg-ivory" },
  confettis: { name: "Confettis", hint: "Festif et dynamique.", swatch: "bg-gold/60" },
  "atelier-creatif": { name: "Atelier créatif", hint: "Textures papier, esprit fait-main.", swatch: "bg-sand" },
  "editorial-luxe": { name: "Éditorial luxe", hint: "Grandes images, mise en page magazine.", swatch: "bg-foreground/80" },
  "boheme-lin": { name: "Bohème lin", hint: "Naturel, lin et bois clair.", swatch: "bg-sand-deep/60" },
  "champetre-pierre": { name: "Champêtre pierre", hint: "Domaines et demeures de caractère.", swatch: "bg-sand-deep/70" },
  "panorama-photo": { name: "Panorama photo", hint: "L'image avant tout, plein écran.", swatch: "bg-sky-deep/60" },
  "corporate-net": { name: "Corporate net", hint: "Structuré, lisible, pour le B2B.", swatch: "bg-sky/50" },
  "moderne-grille": { name: "Moderne grille", hint: "Grille stricte, cartes et contrastes.", swatch: "bg-foreground/60" },
  "table-gourmande": { name: "Table gourmande", hint: "Tons chauds pour la gastronomie.", swatch: "bg-gold/70" },
  "poudre-rose": { name: "Poudre rose", hint: "Délicat, beauté et pâtisserie.", swatch: "bg-blush" },
  "galerie-noire": { name: "Galerie noire", hint: "Fond sombre, photos en vedette.", swatch: "bg-foreground" },
  argentique: { name: "Argentique", hint: "Grain, sépia, intemporel.", swatch: "bg-sand-deep" },
  "nuit-electrique": { name: "Nuit électrique", hint: "Néons et énergie pour la piste.", swatch: "bg-sky-deep" },
  "scene-ouverte": { name: "Scène ouverte", hint: "Spectacle vivant, rideau levé.", swatch: "bg-blush-deep/70" },
  "velours-spectacle": { name: "Velours spectacle", hint: "Rouge profond, cabaret.", swatch: "bg-blush-deep" },
  "jardin-fleuri": { name: "Jardin fleuri", hint: "Motifs floraux et vert tendre.", swatch: "bg-sage-soft" },
  "nature-foret": { name: "Nature forêt", hint: "Vert profond, bois et pierre.", swatch: "bg-sage-deep/80" },
};

export function templateLabel(key: string): string {
  return TEMPLATE_LABELS[key]?.name ?? key;
}

export function TemplatePicker({ keys, selected }: { keys: string[]; selected: string | null }) {
  const list = keys.length ? keys : ["sauge-elegante"];
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Modèle de page publique</legend>
      <p className="mb-3 text-xs text-muted-foreground">Un point de départ pour votre page. Vous pourrez le changer et personnaliser chaque bloc ensuite.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {list.map((k, i) => {
          const meta = TEMPLATE_LABELS[k] ?? { name: k, hint: "", swatch: "bg-muted" };
          return (
            <label key={k} className={cn("cursor-pointer overflow-hidden rounded-xl border transition-colors duration-150 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary has-[:focus-visible]:ring-2")}>
              <input type="radio" name="templateKey" value={k} defaultChecked={selected ? selected === k : i === 0} className="sr-only" />
              <div className={cn("h-20", meta.swatch)} aria-hidden="true" />
              <div className="p-3">
                <p className="text-sm font-medium">{meta.name}</p>
                {meta.hint && <p className="text-xs text-muted-foreground">{meta.hint}</p>}
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
