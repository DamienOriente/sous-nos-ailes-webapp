import type { Block, BlockType } from "@/modules/pages/domain/page-schema";
import { AboutBlock, CtaQuoteBlock, FaqBlock, PricingBlock, ServicesBlock, TestimonialsBlock } from "./content-blocks";
import { HeroBlock, type HeroVariant } from "./hero";
import { AvailabilityBlock, ContactBlock, GalleryBlock, SocialBlock, TrustBlock, ZoneBlock } from "./info-blocks";
import type { BlockContext } from "./shared";

/**
 * Templates describe *how* each block type looks through a variant map and
 * decide the order/wrapping; the block components own the markup. A template
 * never receives raw strings to inject: everything flows through these typed
 * components.
 */
export type VariantMap = Partial<{
  hero: HeroVariant;
  about: "prose" | "two-column" | "with-image" | "pullquote" | "boxed";
  services: "cards" | "list" | "menu" | "tiles" | "steps" | "columns" | "table";
  pricing: "table" | "cards" | "inline";
  gallery: "mosaic" | "band" | "grid" | "filmstrip" | "collage" | "masonry" | "plates" | "duo";
  testimonials: "cards" | "large" | "list";
  faq: "lines" | "cards" | "plain" | "side";
  contact: "panel" | "stacked" | "minimal";
  availability: "grid" | "compact";
  cta_quote: "band" | "boxed" | "split";
  trust: "row" | "card" | "list";
  zone: "text" | "card" | "map";
  social: "pills";
}>;

export function renderBlock(block: Block, ctx: BlockContext, variants: VariantMap = {}): React.ReactNode {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} ctx={ctx} variant={variants.hero} />;
    case "about":
      return <AboutBlock block={block} ctx={ctx} variant={variants.about} />;
    case "services":
      return <ServicesBlock block={block} ctx={ctx} variant={variants.services} />;
    case "pricing":
      return <PricingBlock block={block} ctx={ctx} variant={variants.pricing} />;
    case "gallery":
      return <GalleryBlock block={block} ctx={ctx} variant={variants.gallery} />;
    case "testimonials":
      return <TestimonialsBlock block={block} ctx={ctx} variant={variants.testimonials} />;
    case "faq":
      return <FaqBlock block={block} ctx={ctx} variant={variants.faq} />;
    case "contact":
      return <ContactBlock block={block} ctx={ctx} variant={variants.contact} />;
    case "availability":
      return <AvailabilityBlock block={block} ctx={ctx} variant={variants.availability} />;
    case "social":
      return <SocialBlock block={block} ctx={ctx} />;
    case "cta_quote":
      return <CtaQuoteBlock block={block} ctx={ctx} variant={variants.cta_quote} />;
    case "trust":
      return <TrustBlock block={block} ctx={ctx} variant={variants.trust} />;
    case "zone":
      return <ZoneBlock block={block} ctx={ctx} variant={variants.zone} />;
  }
}

/** Block types that render as empty when they have no data (used to skip wrappers/separators in templates). */
export function blockHasContent(block: Block, ctx: BlockContext): boolean {
  if (ctx.mode === "preview") return true;
  switch (block.type) {
    case "services":
      return block.props.source === "catalog" ? ctx.data.services.length > 0 : block.props.items.length > 0;
    case "pricing":
      return block.props.items.length > 0;
    case "gallery":
      return block.props.images.length > 0;
    case "testimonials":
      return ctx.data.reviews.length > 0;
    case "faq":
      return block.props.items.length > 0;
    case "availability":
      return ctx.data.availability.length > 0;
    case "social":
      return block.props.links.length > 0;
    case "trust":
      return ctx.data.verifications.length > 0 || ctx.data.professional.verificationLevel > 0;
    default:
      return true;
  }
}

/** Visible blocks that will actually output something, hero excluded. */
export function bodyBlocks(blocks: Block[], ctx: BlockContext, exclude: BlockType[] = ["hero"]): Block[] {
  return blocks.filter((b) => !b.hidden && !exclude.includes(b.type) && blockHasContent(b, ctx));
}
