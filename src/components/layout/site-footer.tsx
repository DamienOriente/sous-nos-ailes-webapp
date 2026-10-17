import Link from "next/link";
import { Logo } from "@/components/shared/logo";

const COLUMNS = [
  {
    title: "Organiser",
    links: [
      { href: "/organiser", label: "Préparer un évènement" },
      { href: "/annuaire/garde-enfants-evenementielle", label: "Garde d'enfants pour évènements" },
      { href: "/annuaire", label: "Annuaire des professionnels" },
      { href: "/tarifs", label: "Tarifs" },
    ],
  },
  {
    title: "Professionnels",
    links: [
      { href: "/professionnels", label: "Rejoindre la plateforme" },
      { href: "/professionnels#verification", label: "Vérification des prestataires" },
      { href: "/moderation", label: "Politique de modération" },
      { href: "/classements-sponsorises", label: "Classements sponsorisés" },
    ],
  },
  {
    title: "Sous Nos Ailes",
    links: [
      { href: "/a-propos", label: "À propos" },
      { href: "/contact", label: "Contact" },
      { href: "/signalement", label: "Signaler un contenu" },
      { href: "/accessibilite", label: "Accessibilité" },
    ],
  },
  {
    title: "Juridique",
    links: [
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/cgu", label: "Conditions d'utilisation" },
      { href: "/cgv", label: "Conditions de vente" },
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-ivory-deep/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:px-8">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground text-pretty">
            La plateforme qui réunit garde d'enfants, animation et professionnels de l'évènementiel pour des célébrations sereines.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="space-y-3">
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Sous Nos Ailes — sousnosailes.fr. Plateforme de mise en relation et de coordination.</p>
          <p>Les mentions de vérification décrivent précisément ce qui a été contrôlé. Aucune certification officielle n'est inventée.</p>
        </div>
      </div>
    </footer>
  );
}
