import { cn } from "@/lib/utils";
import { richTextToPlain } from "@/modules/pages/domain/page-schema";
import { labelFor, PRICE_UNITS } from "@/modules/professionals/domain/listing-schema";
import { FaqAccordion } from "./faq-accordion";
import { anchorOf, type BlockProps, CtaButton, formatPrice, headingOr, Picture, RichText, SectionHeading, Stars } from "./shared";

/**
 * Service cards stay text-only: a service has no photograph of its own, and
 * recycling the page's gallery here made the same picture appear several times
 * on one page (and sometimes depict something else than the service).
 */
function servicePictures(): Array<{ fileId: string; alt: string }> {
  return [];
}

/** About: prose | two-column | with-image | pullquote | boxed */
export function AboutBlock({ block, variant = "prose" }: BlockProps<"about">) {
  const heading = headingOr(block, "À propos");
  const { body, imageFileId, imageAlt } = block.props;
  const id = anchorOf(block);
  if (variant === "with-image") {
    return (
      <section id={id} aria-labelledby={`${id}-h`} className="grid gap-8 md:grid-cols-[2fr_3fr] md:items-start">
        <Picture fileId={imageFileId} alt={imageAlt ?? heading} className="aspect-[4/5] rounded-(--pg-radius-lg)" seed={2} />
        <div>
          <SectionHeading className="mb-5">
            <span id={`${id}-h`}>{heading}</span>
          </SectionHeading>
          <RichText body={body} className="text-[1.05rem] leading-relaxed" />
        </div>
      </section>
    );
  }
  if (variant === "two-column") {
    return (
      <section id={id} aria-labelledby={`${id}-h`} className="grid gap-6 md:grid-cols-12">
        <SectionHeading className="md:col-span-4">
          <span id={`${id}-h`}>{heading}</span>
        </SectionHeading>
        <RichText body={body} className="md:col-span-8 text-lg leading-relaxed" />
      </section>
    );
  }
  if (variant === "pullquote") {
    const first = body[0];
    const rest = body.slice(1);
    return (
      <section id={id} aria-labelledby={`${id}-h`} className="mx-auto max-w-3xl">
        <h2 id={`${id}-h`} className="sr-only">
          {heading}
        </h2>
        {first && <RichText body={[first]} className="text-2xl leading-snug sm:text-3xl [&_p]:font-[var(--pg-font-heading)]" />}
        {rest.length > 0 && <RichText body={rest} className={cn("mt-8 text-[1.05rem] leading-relaxed text-(--pg-muted)", richTextToPlain(rest).length > 500 && "columns-1 gap-10 sm:columns-2")} />}
      </section>
    );
  }
  if (variant === "boxed") {
    return (
      <section id={id} aria-labelledby={`${id}-h`} className="rounded-(--pg-radius-lg) border border-(--pg-border) bg-(--pg-surface) p-6 sm:p-10">
        <SectionHeading className="mb-5" size="sm">
          <span id={`${id}-h`}>{heading}</span>
        </SectionHeading>
        <RichText body={body} className="max-w-3xl leading-relaxed" />
      </section>
    );
  }
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mx-auto max-w-3xl">
      <SectionHeading className="mb-5">
        <span id={`${id}-h`}>{heading}</span>
      </SectionHeading>
      <RichText body={body} className="text-[1.05rem] leading-relaxed" />
    </section>
  );
}

const formatDuration = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, "0")}` : ""}` : `${minutes} min`);

/** Services: cards | list | menu | tiles | steps | columns | table */
export function ServicesBlock({ block, ctx, variant = "cards" }: BlockProps<"services">) {
  const heading = headingOr(block, "Prestations");
  const id = anchorOf(block);
  const items =
    block.props.source === "catalog"
      ? ctx.data.services.map((s) => ({
          name: s.name,
          description: s.description ?? undefined,
          priceLabel: s.priceCents ? `à partir de ${formatPrice(s.priceCents)}${s.priceUnit ? ` ${labelFor(PRICE_UNITS, s.priceUnit)}` : ""}` : undefined,
          meta: [s.durationMinutes ? formatDuration(s.durationMinutes) : null, s.minAge !== null || s.maxAge !== null ? `${s.minAge ?? 0}–${s.maxAge ?? 12} ans` : null, s.capacity ? `jusqu'à ${s.capacity} ${s.minAge !== null || s.maxAge !== null ? "enfants" : "personnes"}` : null].filter(Boolean) as string[],
        }))
      : block.props.items.map((s) => ({ ...s, meta: [] as string[] }));

  if (items.length === 0) {
    return ctx.mode === "preview" ? (
      <section id={id} className="rounded-(--pg-radius-md) border border-dashed border-(--pg-border) p-6 text-sm text-(--pg-muted)">
        {heading} : aucune prestation pour l'instant. {block.props.source === "catalog" ? "Ajoutez des prestations à votre catalogue ou passez la section en « texte libre »." : "Ajoutez des prestations dans le panneau de droite."}
      </section>
    ) : null;
  }

  const pictures = servicePictures();
  const head = (
    <div className="mb-8 max-w-2xl">
      <SectionHeading>
        <span id={`${id}-h`}>{heading}</span>
      </SectionHeading>
      {block.props.intro && <p className="mt-3 text-(--pg-muted) text-pretty">{block.props.intro}</p>}
    </div>
  );

  if (variant === "menu") {
    return (
      <section id={id} aria-labelledby={`${id}-h`} className="mx-auto max-w-3xl">
        <SectionHeading align="center" className="mb-8">
          <span id={`${id}-h`}>{heading}</span>
        </SectionHeading>
        <ul className="space-y-6">
          {items.map((it, i) => (
            <li key={i}>
              <div className="pg-leaders text-lg">
                <span className="font-medium">{it.name}</span>
                {it.priceLabel && <span className="text-(--pg-accent)">{it.priceLabel.replace("à partir de ", "dès ")}</span>}
              </div>
              {it.description && <p className="mt-1 text-sm italic text-(--pg-muted) text-pretty">{it.description}</p>}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (variant === "list") {
    return (
      <section id={id} aria-labelledby={`${id}-h`}>
        {head}
        <ul className="divide-y divide-(--pg-border) border-t border-(--pg-border)">
          {items.map((it, i) => (
            <li key={i} className="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:gap-8">
              <div>
                <h3 className="text-lg font-medium" style={{ fontFamily: "var(--pg-font-body)" }}>
                  {it.name}
                </h3>
                {it.description && <p className="mt-1 text-(--pg-muted) text-pretty">{it.description}</p>}
                {it.meta.length > 0 && <p className="mt-1 text-xs text-(--pg-muted)">{it.meta.join(" · ")}</p>}
              </div>
              {it.priceLabel && <p className="text-sm font-medium sm:text-right">{it.priceLabel}</p>}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (variant === "steps") {
    return (
      <section id={id} aria-labelledby={`${id}-h`}>
        {head}
        <ol className="divide-y divide-(--pg-border) border-y border-(--pg-border)">
          {items.map((it, i) => (
            <li key={i} className="grid grid-cols-[3rem_1fr] gap-x-4 py-6 sm:grid-cols-[4.5rem_1fr]">
              <span className="pg-heading text-4xl leading-none text-(--pg-accent) sm:text-5xl" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="text-xl">{it.name}</h3>
                {it.description && <p className="mt-1 text-(--pg-muted) text-pretty">{it.description}</p>}
                {it.meta.length > 0 && <p className="mt-1 text-xs text-(--pg-muted)">{it.meta.join(" · ")}</p>}
                {it.priceLabel && <p className="mt-2 text-sm font-medium">{it.priceLabel}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  if (variant === "tiles") {
    const lead = pictures[0];
    return (
      <section id={id} aria-labelledby={`${id}-h`}>
        {head}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <article key={i} className={cn("flex flex-col justify-between overflow-hidden rounded-(--pg-radius-lg)", i === 0 ? "bg-(--pg-accent) text-(--pg-accent-contrast) sm:col-span-2 lg:col-span-1 lg:row-span-2" : "border border-(--pg-border) bg-(--pg-surface)")}>
              {i === 0 && lead && <Picture fileId={lead.fileId} alt={lead.alt} variant="medium" className="aspect-[4/3]" sizes="(min-width: 1024px) 33vw, 100vw" seed={3} />}
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <h3 className={cn("text-2xl font-semibold", i === 0 && "text-4xl")}>{it.name}</h3>
                  {it.description && <p className={cn("mt-3 text-pretty", i === 0 ? "opacity-90" : "text-(--pg-muted)")}>{it.description}</p>}
                  {it.meta.length > 0 && <p className={cn("mt-2 text-xs", i === 0 ? "opacity-80" : "text-(--pg-muted)")}>{it.meta.join(" · ")}</p>}
                </div>
                {it.priceLabel && <p className="mt-6 text-sm font-semibold">{it.priceLabel}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }
  if (variant === "columns") {
    return (
      <section id={id} aria-labelledby={`${id}-h`}>
        {head}
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <div key={i} className="border-t border-(--pg-text) pt-4">
              <h3 className="text-xl">{it.name}</h3>
              {it.description && <p className="mt-2 text-sm leading-relaxed text-(--pg-muted) text-pretty">{it.description}</p>}
              {it.priceLabel && <p className="mt-3 text-sm font-medium">{it.priceLabel}</p>}
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (variant === "table") {
    return (
      <section id={id} aria-labelledby={`${id}-h`}>
        {head}
        <div className="overflow-x-auto rounded-(--pg-radius-md) border border-(--pg-border)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--pg-surface) text-xs text-(--pg-muted)">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Prestation
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Détail
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Tarif indicatif
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--pg-border)">
              {items.map((it, i) => (
                <tr key={i}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    {it.name}
                  </th>
                  <td className="px-4 py-3 text-(--pg-muted)">{[it.description, ...it.meta].filter(Boolean).join(" · ")}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{it.priceLabel ?? "sur devis"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
  return (
    <section id={id} aria-labelledby={`${id}-h`}>
      {head}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => {
          const pic = pictures.length > 0 ? pictures[i % pictures.length] : undefined;
          return (
            <article key={i} className="flex flex-col overflow-hidden rounded-(--pg-radius-lg) border border-(--pg-border) bg-(--pg-surface)">
              {pic && <Picture fileId={pic.fileId} alt={pic.alt} variant="medium" className="aspect-[3/2]" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" seed={i + 3} />}
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl">{it.name}</h3>
                {it.description && <p className="mt-2 flex-1 text-sm leading-relaxed text-(--pg-muted) text-pretty">{it.description}</p>}
                {it.meta.length > 0 && <p className="mt-3 text-xs text-(--pg-muted)">{it.meta.join(" · ")}</p>}
                {it.priceLabel && <p className="mt-4 text-sm font-semibold text-(--pg-accent)">{it.priceLabel}</p>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Pricing: table | cards | inline. Always "à partir de". */
export function PricingBlock({ block, ctx, variant = "table" }: BlockProps<"pricing">) {
  const heading = headingOr(block, "Tarifs indicatifs");
  const id = anchorOf(block);
  const { items, disclaimer } = block.props;
  if (items.length === 0) {
    return ctx.mode === "preview" ? <section id={id} className="rounded-(--pg-radius-md) border border-dashed border-(--pg-border) p-6 text-sm text-(--pg-muted)">{heading} : ajoutez au moins un tarif « à partir de ».</section> : null;
  }
  const note = disclaimer ?? "Tarifs indicatifs, hors frais de déplacement. Devis gratuit et personnalisé.";
  if (variant === "cards") {
    return (
      <section id={id} aria-labelledby={`${id}-h`}>
        <SectionHeading className="mb-8">
          <span id={`${id}-h`}>{heading}</span>
        </SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-(--pg-radius-lg) border border-(--pg-border) bg-(--pg-surface) p-6">
              <p className="text-sm text-(--pg-muted)">{it.label}</p>
              <p className="mt-2 text-sm text-(--pg-muted)">à partir de</p>
              <p className="pg-heading text-4xl">{formatPrice(it.priceCents)}</p>
              {it.unit && <p className="text-sm text-(--pg-muted)">{it.unit}</p>}
              {it.note && <p className="mt-3 text-xs text-(--pg-muted) text-pretty">{it.note}</p>}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-(--pg-muted)">{note}</p>
      </section>
    );
  }
  if (variant === "inline") {
    return (
      <section id={id} aria-labelledby={`${id}-h`} className="rounded-(--pg-radius-lg) bg-(--pg-accent-soft) p-6 sm:p-8">
        <h2 id={`${id}-h`} className="text-lg font-medium" style={{ fontFamily: "var(--pg-font-body)" }}>
          {heading}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
          {items.map((it, i) => (
            <li key={i}>
              <p className="text-sm text-(--pg-muted)">{it.label}</p>
              <p className="text-2xl">
                <span className="text-sm text-(--pg-muted)">à partir de </span>
                {formatPrice(it.priceCents)}
                {it.unit && <span className="text-sm text-(--pg-muted)"> {it.unit}</span>}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-(--pg-muted)">{note}</p>
      </section>
    );
  }
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mx-auto max-w-3xl">
      <SectionHeading className="mb-6">
        <span id={`${id}-h`}>{heading}</span>
      </SectionHeading>
      <dl className="divide-y divide-(--pg-border) border-y border-(--pg-border)">
        {items.map((it, i) => (
          <div key={i} className="grid gap-1 py-4 sm:grid-cols-[1fr_auto] sm:items-baseline">
            <dt>
              <span className="font-medium">{it.label}</span>
              {it.note && <span className="block text-sm text-(--pg-muted)">{it.note}</span>}
            </dt>
            <dd className="text-right">
              <span className="text-sm text-(--pg-muted)">à partir de </span>
              <span className="text-xl font-medium">{formatPrice(it.priceCents)}</span>
              {it.unit && <span className="text-sm text-(--pg-muted)"> {it.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-(--pg-muted)">{note}</p>
    </section>
  );
}

/** Testimonials: cards | large | list. Only published reviews referenced by id. */
export function TestimonialsBlock({ block, ctx, variant = "cards" }: BlockProps<"testimonials">) {
  const heading = headingOr(block, "Avis");
  const id = anchorOf(block);
  const selected = block.props.reviewIds.length > 0 ? ctx.data.reviews.filter((r) => block.props.reviewIds.includes(r.id)) : ctx.data.reviews.slice(0, 3);
  if (selected.length === 0) {
    return ctx.mode === "preview" ? <section id={id} className="rounded-(--pg-radius-md) border border-dashed border-(--pg-border) p-6 text-sm text-(--pg-muted)">{heading} : cette section affichera vos avis vérifiés dès qu'un client en aura laissé un. Aucun avis ne peut être saisi à la main.</section> : null;
  }
  if (variant === "large") {
    const [first, ...rest] = selected;
    return (
      <section id={id} aria-labelledby={`${id}-h`}>
        <h2 id={`${id}-h`} className="sr-only">
          {heading}
        </h2>
        {first && (
          <figure className="mx-auto max-w-4xl text-center">
            <Stars rating={first.rating} className="justify-center" />
            <blockquote className="mt-4 text-2xl leading-snug sm:text-4xl" style={{ fontFamily: "var(--pg-font-heading)" }}>
              « {first.body} »
            </blockquote>
            <figcaption className="mt-6 flex items-center justify-center gap-3 text-sm text-(--pg-muted)">
              <span>{first.authorName}, avis vérifié{first.title ? `, « ${first.title} »` : ""}</span>
            </figcaption>
          </figure>
        )}
        {rest.length > 0 && (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2">
            {rest.map((r) => (
              <li key={r.id} className="border-t border-(--pg-border) pt-4">
                <Stars rating={r.rating} />
                {r.title && <p className="mt-2 font-medium">{r.title}</p>}
                <p className="mt-2 text-pretty">{r.body}</p>
                <p className="mt-3 text-xs text-(--pg-muted)">{r.authorName}, avis vérifié</p>
                {r.replyBody && <p className="mt-3 rounded-(--pg-radius-sm) bg-(--pg-surface) p-3 text-sm text-pretty">Réponse : {r.replyBody}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }
  if (variant === "list") {
    return (
      <section id={id} aria-labelledby={`${id}-h`} className="mx-auto max-w-3xl">
        <SectionHeading className="mb-6">
          <span id={`${id}-h`}>{heading}</span>
        </SectionHeading>
        <ul className="divide-y divide-(--pg-border)">
          {selected.map((r) => (
            <li key={r.id} className="py-5">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium">{r.authorName}</p>
                <Stars rating={r.rating} />
              </div>
              {r.title && <p className="mt-1 font-medium">{r.title}</p>}
              <p className="mt-1 text-(--pg-muted) text-pretty">{r.body}</p>
              {r.replyBody && <p className="mt-3 rounded-(--pg-radius-sm) bg-(--pg-surface) p-3 text-sm text-pretty">Réponse : {r.replyBody}</p>}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section id={id} aria-labelledby={`${id}-h`}>
      <SectionHeading className="mb-8">
        <span id={`${id}-h`}>{heading}</span>
      </SectionHeading>
      <ul className="grid gap-4 md:grid-cols-3">
        {selected.map((r) => (
          <li key={r.id} className="flex flex-col rounded-(--pg-radius-lg) border border-(--pg-border) bg-(--pg-surface) p-6">
            <Stars rating={r.rating} />
            {r.title && <p className="mt-4 font-medium">{r.title}</p>}
            <p className="mt-2 flex-1 text-(--pg-muted) text-pretty">{r.body}</p>
            <p className="mt-4 text-xs text-(--pg-muted)">{r.authorName}, avis vérifié</p>
            {r.replyBody && <p className="mt-3 border-t border-(--pg-border) pt-3 text-sm text-(--pg-muted) text-pretty">Réponse du professionnel : {r.replyBody}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FaqBlock({ block, ctx, variant = "lines" }: BlockProps<"faq">) {
  const heading = headingOr(block, "Questions fréquentes");
  const id = anchorOf(block);
  if (block.props.items.length === 0) {
    return ctx.mode === "preview" ? <section id={id} className="rounded-(--pg-radius-md) border border-dashed border-(--pg-border) p-6 text-sm text-(--pg-muted)">{heading} : ajoutez vos premières questions.</section> : null;
  }
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn(variant === "side" ? "grid gap-8 md:grid-cols-[1fr_2fr]" : "mx-auto max-w-3xl")}>
      <SectionHeading className={variant === "side" ? "" : "mb-6"}>
        <span id={`${id}-h`}>{heading}</span>
      </SectionHeading>
      <FaqAccordion items={block.props.items} variant={variant === "cards" ? "cards" : variant === "plain" ? "plain" : "lines"} />
    </section>
  );
}

export function CtaQuoteBlock({ block, ctx, variant = "band" }: BlockProps<"cta_quote">) {
  const id = anchorOf(block);
  const { title, text, buttonLabel } = block.props;
  const href = `#${ctx.contactAnchor}`;
  if (variant === "boxed") {
    return (
      <section id={id} className="rounded-(--pg-radius-xl) border border-(--pg-border) bg-(--pg-surface) p-8 text-center sm:p-12">
        <h2 className="text-3xl sm:text-4xl">{title}</h2>
        {text && <p className="mx-auto mt-3 max-w-xl text-(--pg-muted) text-pretty">{text}</p>}
        <CtaButton href={href} size="lg" className="mt-6">
          {buttonLabel}
        </CtaButton>
      </section>
    );
  }
  if (variant === "split") {
    return (
      <section id={id} className="flex flex-col items-start justify-between gap-6 border-y border-(--pg-border) py-10 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-3xl">{title}</h2>
          {text && <p className="mt-2 max-w-xl text-(--pg-muted) text-pretty">{text}</p>}
        </div>
        <CtaButton href={href} size="lg">
          {buttonLabel}
        </CtaButton>
      </section>
    );
  }
  return (
    <section id={id} className="rounded-(--pg-radius-lg) bg-(--pg-accent) px-6 py-12 text-center text-(--pg-accent-contrast) sm:px-12">
      <h2 className="text-3xl sm:text-5xl">{title}</h2>
      {text && <p className="mx-auto mt-4 max-w-xl text-pretty opacity-90">{text}</p>}
      <CtaButton href={href} size="lg" className="mt-8 bg-(--pg-accent-contrast) text-(--pg-accent)">
        {buttonLabel}
      </CtaButton>
    </section>
  );
}
