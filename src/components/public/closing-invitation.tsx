import Link from "next/link";
import { CTA_HREF, CTA_LABEL } from "@/content/site";
import { buttonClasses } from "@/components/ui/button";
import { Sprig } from "@/components/illustrations/botanical";

export function ClosingInvitation({ ownerFirstName }: { ownerFirstName: string }) {
  return (
    <section className="pb-20 sm:pb-24">
      <div className="container-page">
        <div className="plate relative overflow-hidden px-6 py-12 sm:px-12 sm:py-16">
          <Sprig kind="olive" size={120} className="pointer-events-none absolute -top-4 right-4 opacity-80 sm:right-10" />
          <div className="relative max-w-xl">
            <h2 className="font-display text-[2rem] leading-[1.15] sm:text-[2.5rem]">Parlons de votre événement</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-700">
              Décrivez-nous la date, le lieu et les enfants attendus. {ownerFirstName} vous rappelle, précise les détails et vous transmet une proposition. Votre demande n’engage à rien.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={CTA_HREF} className={buttonClasses({ size: "lg" })}>
                {CTA_LABEL}
              </Link>
              <Link href="/contact" className="specimen-link self-start text-[15px] font-semibold text-sage-800 sm:self-auto">
                Écrire à {ownerFirstName}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
