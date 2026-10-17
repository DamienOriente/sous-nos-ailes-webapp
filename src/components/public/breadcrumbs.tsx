import Link from "next/link";
import { JsonLd } from "@/components/public/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo";

export function Breadcrumbs({ items }: { items: Array<{ name: string; path: string }> }) {
  const all = [{ name: "Accueil", path: "/" }, ...items];
  return (
    <>
      <nav aria-label="Fil d’Ariane" className="container-page pt-6 text-[13px] text-ink-500">
        <ol className="flex flex-wrap items-center gap-2">
          {all.map((item, index) => {
            const last = index === all.length - 1;
            return (
              <li key={item.path} className="flex items-center gap-2">
                {last ? (
                  <span aria-current="page" className="text-ink-700">
                    {item.name}
                  </span>
                ) : (
                  <Link href={item.path} className="hover:text-sage-800 hover:underline">
                    {item.name}
                  </Link>
                )}
                {!last ? <span aria-hidden="true">/</span> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(all)} />
    </>
  );
}
