import type { Metadata } from "next";
import { listContentBlocks } from "@/server/services/settings";
import { formatInstantParis } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { ContentBlockForm } from "@/components/admin/content-block-form";

export const metadata: Metadata = { title: "Contenus" };

export default async function ContentsPage() {
  const blocks = await listContentBlocks();
  return (
    <>
      <PageHeader title="Contenus" description="Textes éditables du site public. Chaque bloc s’enregistre séparément ; la modification est visible immédiatement." />
      <Alert kind="info" role="status">
        Texte brut uniquement : une ligne vide sépare deux paragraphes. Les textes marqués « brouillon » (mentions légales, confidentialité) doivent être relus avant toute mise en ligne réelle.
      </Alert>
      <div className="flex flex-col gap-6">
        {blocks.map((block) => (
          <section key={block.key} aria-label={block.title} className="rounded-md border border-sage-200 bg-ivory-50 p-4 sm:p-5">
            <ContentBlockForm blockKey={block.key} title={block.title} body={block.body} />
            <p className="mt-2 text-[13px] text-ink-500">{block.updatedAt ? `Modifié le ${formatInstantParis(block.updatedAt)}.` : "Texte par défaut, jamais modifié."}</p>
          </section>
        ))}
      </div>
    </>
  );
}
