import { cn } from "@/lib/utils";
import { anchorOf, type BlockProps, CtaButton, ctaHref, Picture } from "./shared";

/**
 * Hero variants. Each one is a different composition, not a recolour:
 * fullscreen (image behind text), split (text | image), editorial (giant
 * type, image below), stacked (centred, rounded image), poster (type that
 * overflows), medallion (round portrait), band (low horizontal strip), bold
 * (very large type next to a square picture). The "kicker" line (trade and
 * city by default) sits under the title, never above it.
 */
export type HeroVariant = "fullscreen" | "split" | "editorial" | "stacked" | "poster" | "medallion" | "band" | "bold";

export function HeroBlock({ block, ctx, variant = "split" }: BlockProps<"hero"> & { variant?: HeroVariant }) {
  const { title, subtitle, kicker, imageFileId, imageAlt, cta } = block.props;
  const pro = ctx.data.professional;
  const alt = imageAlt || `${pro.displayName}, ${pro.categoryName}`;
  const href = ctaHref(ctx, cta);
  const kickerLine = kicker ?? `${pro.categoryName}${pro.city ? `, ${pro.city}` : ""}`;
  const id = anchorOf(block);

  switch (variant) {
    case "fullscreen":
      return (
        <header id={id} className="relative isolate min-h-[70svh] overflow-hidden text-white sm:min-h-[82svh]">
          <Picture fileId={imageFileId} alt={alt} className="absolute inset-0 h-full w-full" sizes="100vw" priority seed={1} />
          <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
          <div className="relative mx-auto flex min-h-[70svh] max-w-7xl flex-col justify-end px-5 pb-12 sm:min-h-[82svh] sm:px-8 sm:pb-16">
            <h1 className="max-w-4xl text-5xl font-medium leading-[0.98] sm:text-7xl lg:text-8xl">{title}</h1>
            <p className="mt-4 text-sm font-medium text-white/85">{kickerLine}</p>
            {subtitle && <p className="mt-5 max-w-xl text-lg text-white/85 text-pretty">{subtitle}</p>}
            {cta && (
              <div className="mt-8">
                <CtaButton href={href} size="lg" className="bg-white text-black hover:bg-white/90">
                  {cta.label}
                </CtaButton>
              </div>
            )}
          </div>
        </header>
      );
    case "editorial":
      return (
        <header id={id} className="mx-auto max-w-7xl px-5 pt-14 sm:px-8 sm:pt-20">
          <div className="grid gap-8 border-b border-(--pg-border) pb-10 md:grid-cols-12">
            <h1 className="text-5xl font-normal leading-[0.95] tracking-[-0.03em] md:col-span-9 sm:text-7xl lg:text-[7rem]">{title}</h1>
            <p className="text-sm text-(--pg-muted) md:col-span-3 md:self-end">{kickerLine}</p>
          </div>
          <div className="grid gap-8 py-8 md:grid-cols-12">
            <div className="md:col-span-5 md:col-start-1">
              {subtitle && <p className="text-xl leading-snug text-pretty sm:text-2xl">{subtitle}</p>}
              {cta && (
                <div className="mt-8">
                  <CtaButton href={href}>{cta.label}</CtaButton>
                </div>
              )}
            </div>
            <Picture fileId={imageFileId} alt={alt} className="aspect-[3/2] md:col-span-7" priority seed={1} />
          </div>
        </header>
      );
    case "stacked":
      return (
        <header id={id} className="mx-auto max-w-5xl px-5 pt-14 text-center sm:px-8 sm:pt-20">
          <h1 className="text-4xl font-medium sm:text-6xl">{title}</h1>
          <p className="mt-3 text-sm text-(--pg-muted)">{kickerLine}</p>
          {subtitle && <p className="mx-auto mt-5 max-w-2xl text-lg text-(--pg-muted) text-pretty">{subtitle}</p>}
          {cta && (
            <div className="mt-8">
              <CtaButton href={href} size="lg">
                {cta.label}
              </CtaButton>
            </div>
          )}
          <Picture fileId={imageFileId} alt={alt} className="mt-12 aspect-[16/9] rounded-(--pg-radius-xl)" priority seed={1} />
        </header>
      );
    case "poster":
      return (
        <header id={id} className="relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-5 pt-12 sm:px-8">
            <h1 className="-ml-1 text-[18vw] font-bold leading-[0.82] tracking-[-0.05em] uppercase sm:text-[13vw] lg:text-[10rem]" style={{ fontStretch: "87.5%" }}>
              {title}
            </h1>
            <p className="mt-4 text-lg font-semibold">{kickerLine}</p>
          </div>
          <div className="mt-6 border-y-4 border-(--pg-text) bg-(--pg-accent) text-(--pg-accent-contrast)">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
              <p className="text-lg font-semibold text-pretty">{subtitle}</p>
              {cta && (
                <CtaButton href={href} className="bg-(--pg-text) text-(--pg-bg)">
                  {cta.label}
                </CtaButton>
              )}
            </div>
          </div>
          <Picture fileId={imageFileId} alt={alt} className="aspect-[21/9]" priority seed={1} />
        </header>
      );
    case "medallion":
      return (
        <header id={id} className="mx-auto max-w-5xl px-5 pt-14 sm:px-8 sm:pt-20">
          <div className="flex flex-col items-center gap-8 text-center md:flex-row md:text-left">
            <Picture fileId={imageFileId} alt={alt} className="size-48 shrink-0 rounded-full sm:size-64" sizes="256px" priority seed={1} />
            <div>
              <h1 className="text-5xl font-medium italic sm:text-6xl">{title}</h1>
              <p className="mt-2 text-sm italic text-(--pg-accent)">{kickerLine}</p>
              {subtitle && <p className="mt-4 max-w-xl text-lg text-(--pg-muted) text-pretty">{subtitle}</p>}
              {cta && (
                <div className="mt-6">
                  <CtaButton href={href}>{cta.label}</CtaButton>
                </div>
              )}
            </div>
          </div>
        </header>
      );
    case "band":
      return (
        <header id={id} className="border-b border-(--pg-border) bg-(--pg-surface)">
          <div className="mx-auto grid max-w-7xl items-center gap-6 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto]">
            <div>
              <h1 className="text-3xl font-semibold sm:text-5xl">{title}</h1>
              <p className="mt-2 text-sm font-medium text-(--pg-accent)">{kickerLine}</p>
              {subtitle && <p className="mt-3 max-w-2xl text-(--pg-muted) text-pretty">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-4">
              <Picture fileId={imageFileId} alt={alt} className="size-24 rounded-(--pg-radius-md) sm:size-32" sizes="128px" priority seed={1} />
              {cta && <CtaButton href={href}>{cta.label}</CtaButton>}
            </div>
          </div>
        </header>
      );
    case "bold":
      return (
        <header id={id} className="relative overflow-hidden bg-(--pg-surface)">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 pt-16 pb-12 sm:px-8 sm:pt-24 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <h1 className="text-6xl font-bold leading-[0.9] tracking-[-0.04em] sm:text-8xl">{title}</h1>
              <p className="mt-4 text-sm font-semibold text-(--pg-accent)">{kickerLine}</p>
              {subtitle && <p className="mt-6 max-w-lg text-lg text-(--pg-muted) text-pretty">{subtitle}</p>}
              {cta && (
                <div className="mt-8">
                  <CtaButton href={href} size="lg">
                    {cta.label}
                  </CtaButton>
                </div>
              )}
            </div>
            <Picture fileId={imageFileId} alt={alt} className="aspect-square rounded-(--pg-radius-xl)" priority seed={1} />
          </div>
        </header>
      );
    case "split":
    default:
      return (
        <header id={id} className="mx-auto max-w-7xl px-5 pt-10 sm:px-8 sm:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className={cn("order-2 lg:order-1")}>
              <h1 className="text-5xl font-medium leading-[1.02] sm:text-6xl lg:text-7xl">{title}</h1>
              <p className="mt-3 text-sm text-(--pg-muted)">{kickerLine}</p>
              {subtitle && <p className="mt-5 max-w-lg text-lg text-(--pg-muted) text-pretty">{subtitle}</p>}
              {cta && (
                <div className="mt-8">
                  <CtaButton href={href} size="lg">
                    {cta.label}
                  </CtaButton>
                </div>
              )}
            </div>
            <Picture fileId={imageFileId} alt={alt} className="order-1 aspect-[4/5] rounded-(--pg-radius-lg) lg:order-2" priority seed={1} />
          </div>
        </header>
      );
  }
}
