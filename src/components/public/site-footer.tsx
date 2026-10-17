import Link from "next/link";
import { NAV_PRIMARY, NAV_SECONDARY } from "@/content/site";
import { Sprig } from "@/components/illustrations/botanical";

export function SiteFooter({ brandName, tagline, contactEmail, areaLabel, demo }: { brandName: string; tagline: string; contactEmail: string; areaLabel: string; demo: boolean }) {
  return (
    <footer className="no-print mt-auto bg-sage-800 text-ivory-100">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display text-2xl text-ivory-50">{brandName}</p>
          <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-sage-100">{tagline}</p>
          <Sprig kind="gypsophila" size={64} className="mt-6 [&_*]:!stroke-sage-300" />
        </div>
        <nav aria-label="Pages principales">
          <p className="text-[13px] font-semibold tracking-[0.02em] text-sage-200">Découvrir</p>
          <ul className="mt-3 flex flex-col gap-2">
            {NAV_PRIMARY.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-[15px] text-ivory-100 hover:text-ivory-50 hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Informations">
          <p className="text-[13px] font-semibold tracking-[0.02em] text-sage-200">Informations</p>
          <ul className="mt-3 flex flex-col gap-2">
            {NAV_SECONDARY.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-[15px] text-ivory-100 hover:text-ivory-50 hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/connexion" className="text-[15px] text-ivory-100 hover:text-ivory-50 hover:underline">
                Accéder à mon espace
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="text-[13px] font-semibold tracking-[0.02em] text-sage-200">Contact</p>
          <p className="mt-3 text-[15px] leading-relaxed">
            <a href={`mailto:${contactEmail}`} className="hover:underline">
              {contactEmail}
            </a>
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-sage-100">{areaLabel}</p>
        </div>
      </div>
      <div className="border-t border-sage-700">
        <div className="container-page flex flex-col gap-2 py-5 text-[13px] text-sage-200 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {brandName}. Nom provisoire.</p>
          <p>{demo ? "Version de démonstration : contenus et lieux fictifs." : "Aucun traceur publicitaire n’est utilisé sur ce site."}</p>
        </div>
      </div>
    </footer>
  );
}
