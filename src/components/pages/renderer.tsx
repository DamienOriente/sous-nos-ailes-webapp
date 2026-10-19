import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { anchorOf, type BlockContext, type RenderMode } from "@/components/pages/blocks/shared";
import type { PageRenderData } from "@/modules/pages/domain/render-data";
import { resolveTheme } from "@/modules/pages/domain/theme";
import { TEMPLATE_COMPONENTS } from "./templates";
import "./pages.css";

/**
 * Entry point shared by the public route (server), the builder preview
 * (client) and the template gallery. Resolves the theme into CSS variables and
 * delegates the composition to the template component.
 */
export function PageRenderer({ data, mode, slots, className }: { data: PageRenderData; mode: RenderMode; slots?: BlockContext["slots"]; className?: string }) {
  const theme = resolveTheme(data.templateKey, data.theme);
  const Template = TEMPLATE_COMPONENTS[theme.template.key] ?? TEMPLATE_COMPONENTS["minimal-ivoire"];
  if (!Template) return null;
  const contact = data.content.find((b) => b.type === "contact" && !b.hidden);
  const ctx: BlockContext = { data, mode, slots, contactAnchor: contact ? anchorOf(contact) : "contact" };
  return (
    <div className={cn("pg-root", className)} style={theme.cssVars as CSSProperties} data-template={theme.template.key} data-palette={theme.palette.key}>
      <Template data={data} ctx={ctx} blocks={data.content} />
    </div>
  );
}
