import { cn } from "@/lib/utils";

/** Readable names for template keys (the pages module owns the real template definitions). */
const TEMPLATE_LABELS: Record<string, { name: string; hint: string; swatch: string }> = {
  "nid-douillet": { name: "Nid douillet", hint: "Chaleureux, pastel, pensé pour la garde d'enfants.", swatch: "from-blush/70 to-ivory" },
  "ronde-enfantine": { name: "Ronde enfantine", hint: "Coloré et joueur, pour l'animation jeunesse.", swatch: "from-sky/70 to-gold/50" },
  "sauge-elegante": { name: "Sauge élégante", hint: "Sobre et végétal, le style maison.", swatch: "from-sage-soft to-ivory" },
  "minimal-ivoire": { name: "Minimal ivoire", hint: "Épuré, beaucoup d'espace, typographie forte.", swatch: "from-ivory to-sand" },
  confettis: { name: "Confettis", hint: "Festif et dynamique.", swatch: "from-gold/60 to-blush/60" },
  "atelier-creatif": { name: "Atelier créatif", hint: "Textures papier, esprit fait-main.", swatch: "from-sand to-blush/40" },
  "editorial-luxe": { name: "Éditorial luxe", hint: "Grandes images, mise en page magazine.", swatch: "from-foreground/80 to-foreground/40" },
  "boheme-lin": { name: "Bohème lin", hint: "Naturel, lin et bois clair.", swatch: "from-sand-deep/60 to-ivory" },
  "champetre-pierre": { name: "Champêtre pierre", hint: "Domaines et demeures de caractère.", swatch: "from-sand-deep/70 to-sage-soft" },
  "panorama-photo": { name: "Panorama photo", hint: "L'image avant tout, plein écran.", swatch: "from-sky-deep/60 to-sky/40" },
  "corporate-net": { name: "Corporate net", hint: "Structuré, lisible, pour le B2B.", swatch: "from-sky/50 to-ivory" },
  "moderne-grille": { name: "Moderne grille", hint: "Grille stricte, cartes et contrastes.", swatch: "from-foreground/60 to-sky/40" },
  "table-gourmande": { name: "Table gourmande", hint: "Tons chauds pour la gastronomie.", swatch: "from-gold/70 to-sand" },
  "poudre-rose": { name: "Poudre rose", hint: "Délicat, beauté et pâtisserie.", swatch: "from-blush to-ivory" },
  "galerie-noire": { name: "Galerie noire", hint: "Fond sombre, photos en vedette.", swatch: "from-foreground to-foreground/70" },
  argentique: { name: "Argentique", hint: "Grain, sépia, intemporel.", swatch: "from-sand-deep to-sand" },
  "nuit-electrique": { name: "Nuit électrique", hint: "Néons et énergie pour la piste.", swatch: "from-sky-deep to-blush-deep" },
  "scene-ouverte": { name: "Scène ouverte", hint: "Spectacle vivant, rideau levé.", swatch: "from-blush-deep/70 to-gold/60" },
  "velours-spectacle": { name: "Velours spectacle", hint: "Rouge profond, cabaret.", swatch: "from-blush-deep to-foreground/60" },
  "jardin-fleuri": { name: "Jardin fleuri", hint: "Motifs floraux et vert tendre.", swatch: "from-sage-soft to-blush/50" },
  "nature-foret": { name: "Nature forêt", hint: "Vert profond, bois et pierre.", swatch: "from-sage-deep/80 to-sage-soft" },
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
          const meta = TEMPLATE_LABELS[k] ?? { name: k, hint: "", swatch: "from-muted to-background" };
          return (
            <label key={k} className={cn("cursor-pointer overflow-hidden rounded-xl border transition-colors has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/30 has-[:focus-visible]:ring-2")}>
              <input type="radio" name="templateKey" value={k} defaultChecked={selected ? selected === k : i === 0} className="sr-only" />
              <div className={cn("h-20 bg-gradient-to-br", meta.swatch)} aria-hidden="true" />
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
