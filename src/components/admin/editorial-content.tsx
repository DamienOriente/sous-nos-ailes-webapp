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
            return (
              <a key={i} href={n.href} className="underline underline-offset-2 hover:text-primary" rel={n.href.startsWith("http") ? "noopener noreferrer" : undefined}>
                {n.label}
              </a>
            );
          default:
            return <span key={i}>{n.value}</span>;
        }
      })}
    </>
  );
}

/** Renders the restricted Markdown block tree. Never dangerouslySetInnerHTML. */
export function EditorialContent({ blocks }: { blocks: BlockNode[] }) {
  return (
    <div className="space-y-4 text-pretty leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return b.level === 2 ? (
              <h2 key={i} id={b.id} className="pt-4 text-xl font-semibold">
                <Inlines nodes={b.inlines} />
              </h2>
            ) : (
              <h3 key={i} id={b.id} className="pt-2 text-lg font-semibold">
                <Inlines nodes={b.inlines} />
              </h3>
            );
          case "list":
            return b.ordered ? (
              <ol key={i} className="list-decimal space-y-1 pl-6">
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inlines nodes={item} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="list-disc space-y-1 pl-6">
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inlines nodes={item} />
                  </li>
                ))}
              </ul>
            );
          case "notice":
            return (
              <p key={i} className="rounded-lg border border-warning/50 bg-warning/15 px-4 py-3 text-sm" role="note">
                <Inlines nodes={b.inlines} />
              </p>
            );
          default:
            return (
              <p key={i}>
                <Inlines nodes={b.inlines} />
              </p>
            );
        }
      })}
    </div>
  );
}
