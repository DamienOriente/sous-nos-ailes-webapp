import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Worked examples shown in the workspace: a description that converts, a
 * reply to an inquiry, a service entry. Clearly framed as examples so nobody
 * mistakes them for the professional's own content.
 */
export const DESCRIPTION_EXAMPLE = {
  bad: "Nous proposons des prestations de garde d'enfants pour tous vos évènements. N'hésitez pas à nous contacter pour plus d'informations.",
  good: "Pendant votre mariage, deux intervenantes diplômées installent un espace enfants dans une pièce calme : jeux par âge, atelier couronnes, goûter, coin sieste avec lits parapluie. Les enfants rejoignent les parents pour la cérémonie et le gâteau. Liste des enfants et consignes préparées avec vous avant le jour J, devis sous 48 h.",
  why: ["Un lieu, un moment, un déroulé : l'organisateur se projette.", "Des faits vérifiables (diplômes, ratio, matériel) plutôt que des adjectifs.", "Une promesse concrète pour finir : délai de réponse, ce qui est inclus."],
};

export const REPLY_EXAMPLE = `Bonjour Claire,

Merci pour votre demande. Le samedi 23 mai est disponible. Pour douze enfants de 2 à 11 ans, je vous propose deux intervenantes du cocktail (17 h) jusqu'à 1 h, avec un coin sieste pour les plus petits.

Pour affiner le devis, j'aurais besoin de :
– la pièce ou le coin prévu pour les enfants (intérieur, point d'eau à proximité ?) ;
– les horaires de la cérémonie et du dîner ;
– les éventuelles allergies connues.

Je vous envoie le devis détaillé dès réception, et je reste joignable au 06 12 34 56 78.

Bonne journée,
Marie`;

export const SERVICE_EXAMPLE = {
  name: "Soirée complète avec coin sieste",
  description: "De l'apéritif à 2 h du matin : dîner des enfants, film, histoires et coucher dans des lits parapluie fournis.",
  price: "720 € par évènement · 8 h · 0–12 ans · jusqu'à 15 enfants",
};

export function ExampleFrame({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <aside className={cn("rounded-2xl border border-gold/50 bg-gold/10 p-5", className)} aria-label={title}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Lightbulb className="size-4 text-gold" aria-hidden="true" />
        {title}
      </p>
      <div className="mt-3 space-y-3 text-sm">{children}</div>
    </aside>
  );
}

export function DescriptionExample({ className }: { className?: string }) {
  return (
    <ExampleFrame title="Exemple : une description qui convertit" className={className}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-background/70 p-4">
          <p className="text-xs font-medium text-muted-foreground">Avant</p>
          <p className="mt-1 text-muted-foreground">« {DESCRIPTION_EXAMPLE.bad} »</p>
        </div>
        <div className="rounded-xl bg-background p-4 ring-1 ring-primary/30">
          <p className="text-xs font-medium text-primary">Après</p>
          <p className="mt-1">« {DESCRIPTION_EXAMPLE.good} »</p>
        </div>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        {DESCRIPTION_EXAMPLE.why.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </ExampleFrame>
  );
}

export function ReplyExample({ className }: { className?: string }) {
  return (
    <ExampleFrame title="Exemple de réponse à une demande" className={className}>
      <pre className="rounded-xl bg-background p-4 font-sans text-sm whitespace-pre-wrap">{REPLY_EXAMPLE}</pre>
      <p className="text-muted-foreground">Répondre vite compte dans le classement : une première réponse sous 24 h, même pour demander des précisions, vaut mieux qu'un devis parfait une semaine plus tard.</p>
    </ExampleFrame>
  );
}

export function ServiceExample({ className }: { className?: string }) {
  return (
    <ExampleFrame title="Exemple de prestation bien décrite" className={className}>
      <div className="rounded-xl bg-background p-4">
        <p className="font-medium">{SERVICE_EXAMPLE.name}</p>
        <p className="mt-1 text-muted-foreground">{SERVICE_EXAMPLE.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">{SERVICE_EXAMPLE.price}</p>
      </div>
      <p className="text-muted-foreground">Un nom qui dit le moment couvert, une phrase sur ce qui est inclus, un tarif « à partir de » avec son unité : les organisateurs comparent sur ces trois lignes.</p>
    </ExampleFrame>
  );
}
