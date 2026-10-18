import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const ITEMS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Comment fonctionne la facturation ?",
    a: "Les offres payantes sont des abonnements mensuels à reconduction tacite : le montant est prélevé chaque mois à la date anniversaire de la souscription, jusqu'à résiliation. Le prix affiché est TTC.",
  },
  {
    q: "Comment annuler ?",
    a: "En ligne, depuis Mon compte, onglet Abonnement, bouton « Résilier à l'échéance ». Aucun appel, aucun courrier. L'abonnement reste actif jusqu'à la fin de la période déjà payée, puis s'arrête sans frais.",
  },
  {
    q: "Puis-je changer d'avis après avoir souscrit ?",
    a: (
      <>
        Si vous souscrivez en tant que consommateur, vous disposez d'un droit de rétractation de 14 jours à compter de la souscription, dans les conditions prévues par nos{" "}
        <Link href="/cgv" className="underline">
          conditions générales de vente
        </Link>
        . Les modalités précises (et l'effet d'un usage immédiat du service) y sont décrites.
      </>
    ),
  },
  {
    q: "Que se passe-t-il après une résiliation ?",
    a: (
      <>
        Les fonctionnalités de l'offre payante sont désactivées à la fin de la période : les outils Premium redeviennent inaccessibles, mais rien n'est supprimé. Vos évènements, contacts et pages restent conservés selon notre{" "}
        <Link href="/confidentialite" className="underline">
          politique de conservation
        </Link>
        , et vous pouvez vous réabonner à tout moment.
      </>
    ),
  },
  {
    q: "Mes paiements sont-ils sécurisés ?",
    a: "Les paiements sont traités par Stripe, prestataire de paiement certifié PCI DSS. Sous Nos Ailes ne voit ni ne stocke jamais vos numéros de carte.",
  },
  {
    q: "Que se passe-t-il si un prélèvement échoue ?",
    a: "Vous êtes prévenu par e-mail et dans l'application. L'accès est maintenu jusqu'à la fin de la période déjà réglée pour vous laisser le temps de mettre à jour votre moyen de paiement.",
  },
  {
    q: "Puis-je obtenir des factures ?",
    a: "Oui : vos factures sont disponibles depuis votre espace abonnement (portail de facturation Stripe) et envoyées par e-mail à chaque prélèvement.",
  },
];

export function BillingFaq() {
  return (
    <Accordion type="single" collapsible className="w-full">
      {ITEMS.map((item, i) => (
        <AccordionItem key={i} value={`q-${i}`}>
          <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground text-pretty">{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
