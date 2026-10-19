import { ImageResponse } from "next/og";
import { getPublishedPage } from "@/modules/pages/application/page-service";
import { resolveTheme } from "@/modules/pages/domain/theme";

export const alt = "Page professionnelle sur Sous Nos Ailes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview generated from the listing: name, trade, city, template palette. No remote image fetch. */
export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  const pro = page?.data.professional;
  const theme = resolveTheme(page?.data.templateKey ?? "minimal-ivoire", page?.data.theme);
  const colors = theme.palette.light;
  const accent = theme.accent ?? colors.accent;
  const name = pro?.displayName ?? "Sous Nos Ailes";
  const line = pro ? `${pro.categoryName}${pro.city ? ` · ${pro.city}` : ""}` : "Professionnels de l'évènementiel et de la garde d'enfants";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: colors.bg, color: colors.text, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: 999, background: accent }} />
          <div style={{ fontSize: 28, color: colors.muted }}>{line}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: name.length > 24 ? 72 : 96, fontWeight: 600, lineHeight: 1.02, letterSpacing: -2 }}>{name}</div>
          {pro?.tagline && <div style={{ fontSize: 34, color: colors.muted, lineHeight: 1.3, maxWidth: 1000 }}>{pro.tagline}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, color: colors.muted }}>
          <span>sousnosailes.fr</span>
          <span style={{ background: accent, color: colors.accentContrast, padding: "12px 24px", borderRadius: 999, fontSize: 24 }}>Demander un devis</span>
        </div>
      </div>
    ),
    size,
  );
}
