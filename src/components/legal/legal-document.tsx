import Link from "next/link";
import { Fragment } from "react";
import { Container } from "@/components/shared/section";
import { formatDateFr } from "@/lib/utils";
import { getActor } from "@/lib/session";
import { canGlobal } from "@/modules/authorization";
import type { LegalDocument as LegalDocumentData } from "@/modules/legal/application/legal-pages";
import type { BlockNode, InlineNode } from "@/modules/legal/domain/markdown";

function Inlines({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "strong":
            return <strong key={i}>{n.value}</strong>;
          case "em":
            return <em key={i}>{n.value}</em>;
          case "link":
            return n.href.startsWith("/") ? (
              <Link key={i} href={n.href} className="font-medium text-primary underline underline-offset-4">
                {n.label}
              </Link>
            ) : (
              <a key={i} href={n.href} className="font-medium text-primary underline underline-offset-4" rel="noopener noreferrer">
                {n.label}
              </a>
            );
          default:
            return <Fragment key={i}>{n.value}</Fragment>;
        }
      })}
    </>
  );
}

function Block({ block }: { block: BlockNode }) {
  switch (block.type) {
    case "heading":
      return block.level === 2 ? (
        <h2 id={block.id} className="scroll-mt-28 pt-6 text-xl font-semibold sm:text-2xl">
          <Inlines nodes={block.inlines} />
        </h2>
      ) : (
        <h3 id={block.id} className="scroll-mt-28 pt-2 text-lg font-semibold">
          <Inlines nodes={block.inlines} />
        </h3>
      );
    case "paragraph":
      return (
        <p className="leading-7 text-pretty">
          <Inlines nodes={block.inlines} />
        </p>
      );
    case "list":
      return block.ordered ? (
        <ol className="list-decimal space-y-1.5 pl-6 leading-7">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines nodes={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-1.5 pl-6 leading-7">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines nodes={item} />
            </li>
          ))}
        </ul>
      );
    case "notice":
      return (
        <p role="note" className="rounded-xl border border-warning/50 bg-warning/15 px-4 py-3 text-sm leading-6 text-foreground">
          <Inlines nodes={block.inlines} />
        </p>
      );
  }
}

/** Renders an editorial/legal page from its parsed block tree, with a table of contents on wide screens. */
export async function LegalDocument({ document }: { document: LegalDocumentData }) {
  const actor = await getActor();
  const isStaff = canGlobal(actor, "admin.content.manage");
  return (
    <Container className="py-14 sm:py-20">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold text-balance sm:text-4xl">{document.title}</h1>
        {document.summary && <p className="text-base text-muted-foreground text-pretty sm:text-lg">{document.summary}</p>}
        <p className="text-sm text-muted-foreground">
          {document.status === "published" ? "En vigueur" : "Brouillon"}
          {document.updatedAt && <>, mis à jour le {formatDateFr(document.updatedAt)}</>}
        </p>
        {isStaff && document.incompleteVariables.length > 0 && (
          <p role="status" className="rounded-xl border border-info/40 bg-info/10 px-4 py-3 text-sm">
            Visible par l'équipe seulement : {document.incompleteVariables.length} variable(s) à renseigner dans{" "}
            <Link href="/admin/parametres" className="font-medium underline underline-offset-4">
              Paramètres
            </Link>{" "}
            : {document.incompleteVariables.join(", ")}.
            {document.source === "default" && " Ce texte est le gabarit par défaut : créez la page dans Contenus éditoriaux pour le remplacer."}
          </p>
        )}
      </header>
      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        {document.toc.length > 1 && (
          <nav aria-label="Sommaire" className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 text-sm font-semibold">Sommaire</p>
            <ol className="space-y-2 border-l pl-4 text-sm">
              {document.toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="text-muted-foreground hover:text-foreground">
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <article className="max-w-3xl space-y-5 text-[17px]">
          {document.blocks.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </article>
      </div>
    </Container>
  );
}
