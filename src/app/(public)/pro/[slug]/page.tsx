import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { CalendarPlus } from "lucide-react";
import { FavoriteButton } from "@/components/directory/favorite-button";
import { VerificationBadge } from "@/components/directory/verification-badge";
import { InquiryForm } from "@/components/inquiries/inquiry-form";
import { PageRenderer } from "@/components/pages/renderer";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getActor } from "@/lib/session";
import { isFavorite } from "@/modules/directory/application/favorites-service";
import { publicImageHref } from "@/modules/files/application/file-urls";
import { getPublishedPage, incrementViewCount } from "@/modules/pages/application/page-service";
import { buildJsonLd, generateDescription, generateTitle, serializeJsonLd } from "@/modules/seo/domain/meta";

/**
 * Public page of a professional: server-rendered from the approved version.
 * 404 when the listing is not published; noindex for demo listings, non
 * indexable profiles or while INDEXING_ENABLED is off.
 */
type Params = { slug: string };

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|uptime|curl|wget|python-requests/i;

async function load(slug: string) {
  return getPublishedPage(slug);
}

function heroImage(page: Awaited<ReturnType<typeof getPublishedPage>>): string | null {
  if (!page) return null;
  const hero = page.data.content.find((b) => b.type === "hero" && !b.hidden);
  if (hero && hero.type === "hero" && hero.props.imageFileId) return `${env.APP_URL}${publicImageHref(hero.props.imageFileId, "large")}`;
  const gallery = page.data.content.find((b) => b.type === "gallery" && !b.hidden);
  const first = gallery && gallery.type === "gallery" ? gallery.props.images[0] : undefined;
  return first ? `${env.APP_URL}${publicImageHref(first.fileId, "large")}` : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) return { title: "Page introuvable", robots: { index: false, follow: false } };
  const pro = page.data.professional;
  const title = page.data.seoTitle?.trim() || generateTitle(pro);
  const description = page.data.seoDescription?.trim() || generateDescription(pro, page.data.content);
  const url = `${env.APP_URL}/pro/${pro.slug}`;
  const indexable = env.INDEXING_ENABLED && page.isIndexable && !pro.isDemo;
  const image = heroImage(page);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false, noarchive: true },
    openGraph: { type: "profile", title, description, url, siteName: "Sous Nos Ailes", locale: "fr_FR", ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function PublicProfessionalPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) notFound();
  const { data } = page;
  const pro = data.professional;
  const url = `${env.APP_URL}/pro/${pro.slug}`;
  const title = data.seoTitle?.trim() || generateTitle(pro);
  const description = data.seoDescription?.trim() || generateDescription(pro, data.content);
  const jsonLd = buildJsonLd(data, { url, siteUrl: env.APP_URL, title, description, imageUrl: heroImage(page) });

  const [actor, ua] = await Promise.all([getActor(), headers().then((h) => h.get("user-agent") ?? "")]);
  const favorite = actor ? await isFavorite(actor.userId, pro.id).catch(() => false) : false;

  if (!BOT_UA.test(ua)) {
    after(() => incrementViewCount(page.publicProfileId).catch((err) => logger.warn({ err, slug }, "view count increment failed")));
  }

  const statements = data.verifications.map((v) => v.statement).filter((s): s is string => Boolean(s));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      {pro.isDemo && (
        <div role="note" className="border-b border-warning/40 bg-warning/15 px-4 py-2 text-center text-sm text-foreground">
          Fiche de démonstration : ce professionnel est fictif, aucune demande réelle ne lui parvient.
        </div>
      )}
      <div className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">Accueil</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/annuaire">Annuaire</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/annuaire/${pro.categorySlug}`}>{pro.categoryName}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{pro.displayName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-2">
            <VerificationBadge level={pro.verificationLevel} statements={statements} />
            <FavoriteButton professionalId={pro.id} isFavorite={favorite} signedIn={Boolean(actor)} />
            <Button asChild size="sm" variant="outline">
              <Link href={`/app/evenements?invite=${pro.id}`}>
                <CalendarPlus aria-hidden="true" />
                Inviter sur mon évènement
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <PageRenderer
        data={data}
        mode="public"
        slots={{
          inquiryForm: <InquiryForm professionalId={pro.id} professionalName={pro.displayName} defaultKind="quote" />,
          verificationBadge: <VerificationBadge level={pro.verificationLevel} statements={statements} size="md" />,
        }}
      />
    </>
  );
}
