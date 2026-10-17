import { DemoPhoto } from "@/components/shared/demo-photo";
import type { DemoPhoto as DemoPhotoEntry } from "@/modules/media/demo-photos";

/**
 * Directory page header: title + intro on the left, an ambiance photograph on
 * the right (always an illustration from the demo catalogue, labelled as such,
 * never a professional's own picture).
 */
export function DirectoryHeader({ eyebrow, title, children, photos }: { eyebrow?: string; title: string; children?: React.ReactNode; photos: DemoPhotoEntry[] }) {
  const [first, ...rest] = photos;
  return (
    <header className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-10">
      <div className="space-y-3">
        {eyebrow && <p className="text-sm font-medium text-primary">{eyebrow}</p>}
        <h1 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">{title}</h1>
        {children}
      </div>
      {first && (
        <figure className="m-0">
          <div className={rest.length ? "grid grid-cols-[1.4fr_1fr] gap-2" : ""}>
            <DemoPhoto photo={first} priority width={900} height={600} sizes="(max-width: 1024px) 100vw, 420px" className={rest.length ? "row-span-2 aspect-[4/3] rounded-[1.5rem] rounded-tl-[3.5rem]" : "aspect-[16/9] rounded-[1.5rem] rounded-tl-[3.5rem]"} alt="" />
            {rest.slice(0, 2).map((p, i) => (
              <DemoPhoto key={p.id} photo={p} width={600} height={450} sizes="(max-width: 1024px) 40vw, 170px" className={`aspect-[4/3] rounded-[1.25rem] ${i === 0 ? "rounded-tr-[2.5rem]" : "rounded-br-[2.5rem]"}`} alt="" />
            ))}
          </div>
          <figcaption className="mt-2 font-heading text-sm text-muted-foreground italic">Photos d'illustration : aucune ne représente un professionnel de l'annuaire.</figcaption>
        </figure>
      )}
    </header>
  );
}
