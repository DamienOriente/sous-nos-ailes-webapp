import { cn } from "@/lib/utils";
import { LightboxGallery, type GalleryLayout } from "./lightbox-gallery";
import { anchorOf, type BlockProps, Chip, CtaButton, headingOr, minutesToTime, SectionHeading, SOCIAL_LABELS, VERIFICATION_LABELS, WEEKDAYS_FR } from "./shared";

export function GalleryBlock({ block, ctx, variant = "grid" }: BlockProps<"gallery">) {
  const heading = headingOr(block, "En images");
  const id = anchorOf(block);
  const images = block.props.images;
  if (images.length === 0) {
    return ctx.mode === "preview" ? <section id={id} className="rounded-(--pg-radius-md) border border-dashed border-(--pg-border) p-6 text-sm text-(--pg-muted)">{heading} : ajoutez vos premières photos (3 minimum conseillées).</section> : null;
  }
  const layout = variant as GalleryLayout;
  const bleed = layout === "mosaic" || layout === "band" || layout === "filmstrip";
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn(bleed && "-mx-5 sm:-mx-8")}>
      <SectionHeading className={cn("mb-6", bleed && "px-5 sm:px-8", layout === "filmstrip" && "italic")}>
        <span id={`${id}-h`}>{heading}</span>
      </SectionHeading>
      <LightboxGallery images={images} layout={layout} className={cn(layout === "band" && "px-5 sm:px-8", layout === "mosaic" && "px-2")} />
    </section>
  );
}

/** Contact: panel (coordinates + form side by side) | stacked | minimal */
export function ContactBlock({ block, ctx, variant = "panel" }: BlockProps<"contact">) {
  const heading = headingOr(block, "Contact");
  const id = anchorOf(block);
  const pro = ctx.data.professional;
  const { showEmail, showPhone, showWebsite, note, buttonLabel } = block.props;
  const lines = [
    showEmail && pro.publicEmail ? { label: "E-mail", value: pro.publicEmail, href: `mailto:${pro.publicEmail}` } : null,
    showPhone && pro.publicPhone ? { label: "Téléphone", value: pro.publicPhone, href: `tel:${pro.publicPhone.replace(/\s+/g, "")}` } : null,
    showWebsite && pro.website && /^https?:\/\//.test(pro.website) ? { label: "Site web", value: pro.website.replace(/^https?:\/\//, "").replace(/\/$/, ""), href: pro.website } : null,
    pro.city ? { label: "Basé à", value: `${pro.city}${pro.postalCode ? ` (${pro.postalCode})` : ""}`, href: null } : null,
  ].filter((l): l is { label: string; value: string; href: string | null } => Boolean(l));

  const form = ctx.slots?.inquiryForm ?? (
    <div className="rounded-(--pg-radius-lg) border border-dashed border-(--pg-border) p-6 text-center text-sm text-(--pg-muted)">
      {ctx.mode === "preview" ? "Le formulaire de demande de devis apparaît ici sur la page publique." : <CtaButton href="/annuaire">Faire une demande via l'annuaire</CtaButton>}
    </div>
  );

  const coords = (
    <dl className="space-y-3">
      {lines.map((l) => (
        <div key={l.label}>
          <dt className="text-xs text-(--pg-muted)">{l.label}</dt>
          <dd className="font-medium">{l.href ? (
            <a href={l.href} rel={l.label === "Site web" ? "noopener noreferrer" : undefined} target={l.label === "Site web" ? "_blank" : undefined} className="hover:text-(--pg-accent)">
              {l.value}
            </a>
          ) : (
            l.value
          )}</dd>
        </div>
      ))}
    </dl>
  );

  if (variant === "minimal") {
    return (
      <section id={id} aria-labelledby={`${id}-h`} className="mx-auto max-w-2xl">
        <SectionHeading align="center" className="mb-3">
          <span id={`${id}-h`}>{heading}</span>
        </SectionHeading>
        {note && <p className="mb-6 text-center text-(--pg-muted) text-pretty">{note}</p>}
        <div className="mb-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm">
          {lines.map((l) => (
            <span key={l.label}>{l.href ? <a href={l.href} className="underline underline-offset-4 hover:text-(--pg-accent)">{l.value}</a> : l.value}</span>
          ))}
        </div>
        {form}
      </section>
    );
  }
  if (variant === "stacked") {
    return (
      <section id={id} aria-labelledby={`${id}-h`} className="rounded-(--pg-radius-xl) bg-(--pg-surface) p-6 sm:p-10">
        <SectionHeading className="mb-2">
          <span id={`${id}-h`}>{heading}</span>
        </SectionHeading>
        {note && <p className="mb-6 max-w-xl text-(--pg-muted) text-pretty">{note}</p>}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">{coords}</div>
        {form}
      </section>
    );
  }
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid gap-10 lg:grid-cols-[2fr_3fr]">
      <div>
        <SectionHeading className="mb-3">
          <span id={`${id}-h`}>{heading}</span>
        </SectionHeading>
        <p className="mb-6 text-(--pg-muted) text-pretty">{note ?? `${buttonLabel ?? "Décrivez votre évènement"} : réponse personnalisée sous 48 h, sans engagement.`}</p>
        {coords}
      </div>
      <div>{form}</div>
    </section>
  );
}

/** Availability: weekly grid from professional_availability. */
export function AvailabilityBlock({ block, ctx, variant = "grid" }: BlockProps<"availability">) {
  const heading = headingOr(block, "Disponibilités habituelles");
  const id = anchorOf(block);
  const rows = ctx.data.availability;
  if (rows.length === 0) {
    return ctx.mode === "preview" ? <section id={id} className="rounded-(--pg-radius-md) border border-dashed border-(--pg-border) p-6 text-sm text-(--pg-muted)">{heading} : renseignez vos créneaux hebdomadaires dans votre fiche pour afficher cette section.</section> : null;
  }
  const byDay = WEEKDAYS_FR.map((name, d) => ({
    name,
    slots: rows
      .filter((r) => r.weekday === d)
      .sort((a, b) => a.startMinute - b.startMinute)
      .map((r) => `${minutesToTime(r.startMinute)} – ${minutesToTime(r.endMinute)}`),
  }));
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn(variant === "compact" && "mx-auto max-w-2xl")}>
      <SectionHeading className="mb-6" size={variant === "compact" ? "sm" : "md"}>
        <span id={`${id}-h`}>{heading}</span>
      </SectionHeading>
      <ul className={cn("grid gap-2", variant === "compact" ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7")}>
        {byDay.map((d) => (
          <li key={d.name} className={cn("rounded-(--pg-radius-md) border border-(--pg-border) p-3", d.slots.length > 0 ? "bg-(--pg-surface)" : "opacity-80", variant === "compact" && "flex items-center justify-between")}>
            <p className="text-sm font-medium">{d.name}</p>
            <p className="mt-1 text-xs text-(--pg-muted)">{d.slots.length > 0 ? d.slots.join(", ") : "—"}</p>
          </li>
        ))}
      </ul>
      {block.props.note && <p className="mt-4 text-xs text-(--pg-muted) text-pretty">{block.props.note}</p>}
    </section>
  );
}

export function SocialBlock({ block, ctx }: BlockProps<"social">) {
  const heading = headingOr(block, "Suivez-nous");
  const id = anchorOf(block);
  if (block.props.links.length === 0) {
    return ctx.mode === "preview" ? <section id={id} className="rounded-(--pg-radius-md) border border-dashed border-(--pg-border) p-6 text-sm text-(--pg-muted)">{heading} : ajoutez vos liens.</section> : null;
  }
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex flex-wrap items-center gap-4">
      <h2 id={`${id}-h`} className="text-base font-medium" style={{ fontFamily: "var(--pg-font-body)" }}>
        {heading}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {block.props.links.map((l) => (
          <li key={l.network + l.url}>
            <a href={l.url} target="_blank" rel="noopener noreferrer me" className="inline-flex items-center rounded-(--pg-radius-sm) border border-(--pg-border) px-3 py-1.5 text-sm hover:border-(--pg-accent) hover:text-(--pg-accent)">
              {SOCIAL_LABELS[l.network] ?? l.network}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Trust: only real verifications; the level badge comes from the directory module when provided. */
export function TrustBlock({ block, ctx, variant = "row" }: BlockProps<"trust">) {
  const heading = headingOr(block, "Confiance");
  const id = anchorOf(block);
  const items = ctx.data.verifications;
  const level = ctx.data.professional.verificationLevel;
  if (items.length === 0 && level === 0) {
    return ctx.mode === "preview" ? <section id={id} className="rounded-(--pg-radius-md) border border-dashed border-(--pg-border) p-6 text-sm text-(--pg-muted)">{heading} : cette section affichera vos vérifications (SIRENE, assurance…) une fois validées par la plateforme.</section> : null;
  }
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn(variant === "card" && "rounded-(--pg-radius-lg) border border-(--pg-border) bg-(--pg-surface) p-6")}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`${id}-h`} className="text-base font-medium" style={{ fontFamily: "var(--pg-font-body)" }}>
          {heading}
        </h2>
        {ctx.slots?.verificationBadge}
      </div>
      <ul className={cn("mt-4 flex flex-wrap gap-2", variant === "list" && "flex-col gap-3")}>
        {items.map((v) => (
          <li key={v.kind}>
            <Chip className={cn(variant === "list" && "border-0 bg-transparent px-0 text-sm")}>
              <svg viewBox="0 0 20 20" className="mr-1.5 size-3.5 fill-none stroke-(--pg-accent) stroke-2" aria-hidden="true">
                <path d="M4 10.5l4 4 8-9" />
              </svg>
              {VERIFICATION_LABELS[v.kind] ?? v.kind}
            </Chip>
            {variant === "list" && v.statement && <p className="mt-0.5 text-xs text-(--pg-muted)">{v.statement}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-(--pg-muted) text-pretty">{block.props.note ?? "Chaque mention correspond à un contrôle réellement effectué par Sous Nos Ailes ; rien n'est déclaré au-delà."}</p>
    </section>
  );
}

export function ZoneBlock({ block, ctx, variant = "text" }: BlockProps<"zone">) {
  const heading = headingOr(block, "Zone d'intervention");
  const id = anchorOf(block);
  const pro = ctx.data.professional;
  const departments = Array.from(new Set([pro.department, ...block.props.departments].filter((d): d is string => Boolean(d))));
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn(variant === "card" && "rounded-(--pg-radius-lg) bg-(--pg-accent-soft) p-6 sm:p-8", variant === "map" && "grid items-center gap-8 md:grid-cols-[auto_1fr]")}>
      {variant === "map" && (
        <svg viewBox="0 0 120 120" className="size-32 shrink-0" aria-hidden="true">
          <circle cx="60" cy="60" r="54" className="fill-(--pg-accent) opacity-15" />
          <circle cx="60" cy="60" r="34" className="fill-(--pg-accent) opacity-25" />
          <circle cx="60" cy="60" r="6" className="fill-(--pg-accent)" />
        </svg>
      )}
      <div>
        <SectionHeading size="sm" className="mb-3">
          <span id={`${id}-h`}>{heading}</span>
        </SectionHeading>
        <p className="text-pretty">
          {pro.interventionRadiusKm > 0 ? (
            <>
              {pro.city ? <>Basé à <strong>{pro.city}</strong>, </> : null}
              intervention dans un rayon d'environ <strong>{pro.interventionRadiusKm} km</strong>
              {pro.region ? ` (${pro.region})` : ""}.
            </>
          ) : (
            <>
              Accueil sur place{pro.city ? <> à <strong>{pro.city}</strong></> : null}
              {pro.region ? ` (${pro.region})` : ""}.
            </>
          )}
        </p>
        {departments.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Départements couverts">
            {departments.map((d) => (
              <li key={d}>
                <Chip>Dép. {d}</Chip>
              </li>
            ))}
          </ul>
        )}
        {block.props.note && <p className="mt-3 text-sm text-(--pg-muted) text-pretty">{block.props.note}</p>}
      </div>
    </section>
  );
}
