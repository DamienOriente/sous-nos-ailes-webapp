import Image from "next/image";
import { cn } from "@/lib/utils";
import { publicImageHref, type ImageVariant } from "@/modules/files/application/file-urls";
import type { Block, BlockType, Inline, RichText as RichTextModel } from "@/modules/pages/domain/page-schema";
import type { PageRenderData } from "@/modules/pages/domain/render-data";
import { isSampleFileId as isSampleId, SAMPLE_FILE_PREFIX as SAMPLE_PREFIX, sampleImageSrc, samplePhotoFromFileId, type SampleVariant } from "@/modules/pages/domain/sample-photos";

/**
 * Shared building bricks for blocks and templates. No hooks, no IO: these
 * components render on the server for the public page and on the client for
 * the builder's live preview.
 */
export type RenderMode = "public" | "preview";

export type BlockContext = {
  data: PageRenderData;
  mode: RenderMode;
  /** Server-provided islands (inquiry form, verification badge) available only on the public page. */
  slots?: { inquiryForm?: React.ReactNode; verificationBadge?: React.ReactNode };
  /** Anchor of the contact block, for CTA buttons. */
  contactAnchor: string;
};

export type BlockProps<T extends BlockType> = { block: Extract<Block, { type: T }>; ctx: BlockContext; variant?: string };

/** Gallery/preview sample images use this sentinel prefix: they render as catalogue photos or palette placeholders, never as a request to /api/files. */
export const SAMPLE_FILE_PREFIX = SAMPLE_PREFIX;
export const isSampleFileId = isSampleId;

/** Source URL for an image reference: the files API for real uploads, Unsplash for sample ids. Null means "draw a placeholder". */
export function imageSrcFor(fileId: string | null | undefined, variant: ImageVariant = "large"): string | null {
  if (!fileId) return null;
  if (isSampleFileId(fileId)) {
    const photo = samplePhotoFromFileId(fileId);
    return photo ? sampleImageSrc(photo, variant as SampleVariant) : null;
  }
  return publicImageHref(fileId, variant);
}

/**
 * Files served by our own API already come as WebP variants sized by the
 * pipeline (thumb/medium/large) and are reached through a signed redirect:
 * running them through next/image's optimizer would fetch and re-encode them a
 * second time (and query strings on local sources require `images.localPatterns`).
 * Catalogue photos (Unsplash) do go through the optimizer.
 */
export const isFilesApiSrc = (src: string): boolean => src.startsWith("/api/files/");

/** Dominant tone of a sample photo, used behind the picture while it loads. */
export function imageToneFor(fileId: string | null | undefined): string | undefined {
  return samplePhotoFromFileId(fileId)?.tone;
}

export const ANCHOR_PREFIX = "section-";
export const anchorOf = (block: Pick<Block, "id">) => `${ANCHOR_PREFIX}${block.id}`;

export function ctaHref(ctx: BlockContext, cta?: { action: "quote" | "contact" | "anchor"; anchor?: string }): string {
  if (!cta || cta.action === "quote" || cta.action === "contact") return `#${ctx.contactAnchor}`;
  return cta.anchor ? `#${ANCHOR_PREFIX}${cta.anchor}` : `#${ctx.contactAnchor}`;
}

// ── Picture ─────────────────────────────────────────────────────────────────
/**
 * Image from the files module, or a palette-coloured placeholder when none is
 * set (drafts, demo data). Always has an alt; decorative placeholders are hidden
 * from assistive tech.
 */
export function Picture({
  fileId,
  alt,
  variant = "large",
  className,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  priority = false,
  seed = 0,
  placeholderLabel,
}: {
  fileId?: string | null;
  alt: string;
  variant?: ImageVariant;
  className?: string;
  sizes?: string;
  priority?: boolean;
  seed?: number;
  placeholderLabel?: string;
}) {
  const src = imageSrcFor(fileId, variant);
  if (!src) return <Placeholder className={className} seed={seed} label={placeholderLabel} />;
  return (
    <div className={cn("relative overflow-hidden bg-(--pg-surface)", className)} style={imageToneFor(fileId) ? { backgroundColor: imageToneFor(fileId) } : undefined} data-pg-picture="">
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={isFilesApiSrc(src)} className="object-cover" />
    </div>
  );
}

/** Abstract composition in the template's palette; varies with `seed` so galleries do not repeat. */
export function Placeholder({ className, seed = 0, label }: { className?: string; seed?: number; label?: string }) {
  const k = Math.abs(seed) % 5;
  const shapes = [
    <circle key="a" cx="70" cy="40" r="26" />,
    <rect key="b" x="18" y="52" width="46" height="34" rx="6" />,
    <path key="c" d="M10 80 C 30 40, 60 40, 90 80 Z" />,
    <polygon key="d" points="50,14 86,78 14,78" />,
    <ellipse key="e" cx="48" cy="58" rx="34" ry="20" />,
  ];
  return (
    <div className={cn("relative overflow-hidden bg-(--pg-accent-soft)", className)} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full fill-(--pg-accent) opacity-25">
        {shapes[k]}
        {shapes[(k + 2) % 5]}
      </svg>
      {label && <span className="absolute inset-x-0 bottom-3 text-center text-xs text-(--pg-muted)">{label}</span>}
    </div>
  );
}

// ── Text ────────────────────────────────────────────────────────────────────
export function RichText({ body, className }: { body: RichTextModel; className?: string }) {
  return (
    <div className={cn("space-y-4 text-pretty", className)}>
      {body.map((b, i) => {
        if (b.type === "paragraph") return <p key={i}>{b.children.map((c, j) => <InlineRun key={j} run={c} />)}</p>;
        const List = b.ordered ? "ol" : "ul";
        return (
          <List key={i} className={cn("space-y-1.5 pl-5", b.ordered ? "list-decimal" : "list-disc marker:text-(--pg-accent)")}>
            {b.items.map((item, j) => (
              <li key={j}>{item.map((c, k) => <InlineRun key={k} run={c} />)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

function InlineRun({ run }: { run: Inline }) {
  let node: React.ReactNode = run.text;
  if (run.bold) node = <strong className="font-semibold">{node}</strong>;
  if (run.italic) node = <em>{node}</em>;
  return <>{node}</>;
}

export function SectionHeading({ children, as: Tag = "h2", className, align = "left", size = "md" }: { children: React.ReactNode; as?: "h2" | "h3"; className?: string; align?: "left" | "center"; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = { sm: "text-xl sm:text-2xl", md: "text-2xl sm:text-3xl", lg: "text-3xl sm:text-4xl lg:text-5xl", xl: "text-4xl sm:text-5xl lg:text-6xl" };
  return <Tag className={cn("font-medium leading-[1.08]", sizes[size], align === "center" && "text-center", className)}>{children}</Tag>;
}

export function CtaButton({ href, children, className, tone = "accent", size = "md" }: { href: string; children: React.ReactNode; className?: string; tone?: "accent" | "outline" | "text"; size?: "md" | "lg" }) {
  const tones = {
    accent: "bg-(--pg-accent) text-(--pg-accent-contrast) hover:opacity-90",
    outline: "border border-current text-(--pg-text) hover:bg-(--pg-accent-softer)",
    text: "text-(--pg-accent) underline underline-offset-4 hover:opacity-80 px-0",
  };
  return (
    <a
      href={href}
      className={cn("inline-flex items-center justify-center gap-2 rounded-(--pg-radius-md) font-medium transition-[opacity,background-color]", size === "lg" ? "px-6 py-3.5 text-base" : "px-5 py-2.5 text-sm", tones[tone], className)}
    >
      {children}
    </a>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-(--pg-radius-sm) border border-(--pg-border) bg-(--pg-surface) px-2.5 py-1 text-xs font-medium text-(--pg-text)", className)}>{children}</span>;
}

/** Initials disc for reviews and team lists: the accent at low opacity, the letters in the accent. */
export function Monogram({ name, className, size = "md" }: { name: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.replace(/[^\p{L}]/gu, "")[0]?.toUpperCase() ?? "")
    .join("");
  const sizes = { sm: "size-8 text-xs", md: "size-11 text-sm", lg: "size-14 text-base" };
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-(--pg-accent-soft) font-semibold tracking-wide text-(--pg-accent)", sizes[size], className)} style={{ fontFamily: "var(--pg-font-body)" }}>
      {initials || "?"}
    </span>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-(--pg-accent)", className)} role="img" aria-label={`${rating} sur 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={cn("size-4", i < rating ? "fill-current" : "fill-current opacity-25")} aria-hidden="true">
          <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L10 14.9l-5.3 2.8 1.1-5.9L1.5 7.7l5.9-.8z" />
        </svg>
      ))}
    </span>
  );
}

// ── Formatting ──────────────────────────────────────────────────────────────
export const formatPrice = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

export const WEEKDAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const minutesToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}h${m % 60 === 0 ? "" : String(m % 60).padStart(2, "0")}`;

export const VERIFICATION_LABELS: Record<string, string> = {
  identity_declared: "Identité déclarée",
  business_registration_checked: "Immatriculation vérifiée (SIRENE)",
  documents_reviewed: "Justificatifs examinés",
  insurance_declared: "Assurance déclarée",
  insurance_verified: "Attestation d'assurance vérifiée",
  qualification_declared: "Qualification déclarée",
  qualification_verified: "Qualification vérifiée",
  administrative_check_done: "Contrôle administratif effectué",
};

export const SOCIAL_LABELS: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", pinterest: "Pinterest", website: "Site web" };

export function headingOr(block: { props: { heading?: string } }, fallback: string): string {
  return block.props.heading?.trim() || fallback;
}
