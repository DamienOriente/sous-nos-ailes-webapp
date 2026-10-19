import type { PageContent, PageTheme } from "./page-schema";

/**
 * Everything a template needs to render a page, resolved server side once and
 * passed down as plain serialisable data (the same object feeds the public
 * page, the builder's live preview and the template gallery).
 */
export type ProfessionalSnapshot = {
  id: string;
  slug: string;
  displayName: string;
  tagline: string | null;
  description: string | null;
  categoryName: string;
  categorySlug: string;
  categoryGroup: string;
  city: string | null;
  postalCode: string | null;
  department: string | null;
  region: string | null;
  interventionRadiusKm: number;
  priceFromCents: number | null;
  priceToCents: number | null;
  priceUnit: string | null;
  languages: string[];
  eventTypes: string[];
  yearsExperience: number | null;
  publicEmail: string | null;
  publicPhone: string | null;
  website: string | null;
  socialLinks: Record<string, string>;
  verificationLevel: number;
  averageRating: number | null;
  reviewCount: number;
  isDemo: boolean;
  acceptsChildrenServices: boolean;
  status: string;
  publishedAt: string | null;
};

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  priceUnit: string | null;
  durationMinutes: number | null;
  minAge: number | null;
  maxAge: number | null;
  capacity: number | null;
};

export type ReviewRow = {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  replyBody: string | null;
  createdAt: string;
  /** "Mariage, juin 2026": the finished collaboration that proves the review. */
  verifiedLabel?: string | null;
};

export type AvailabilityRow = { weekday: number; startMinute: number; endMinute: number };

export type VerificationRow = { kind: string; status: string; statement: string | null; reviewedAt: string | null };

export type ImageMeta = { fileId: string; width: number | null; height: number | null; sizeBytes: number | null; mimeType: string | null };

export type PageRenderData = {
  professional: ProfessionalSnapshot;
  templateKey: string;
  theme: PageTheme;
  content: PageContent;
  services: ServiceRow[];
  /** Only reviews with status = published. */
  reviews: ReviewRow[];
  availability: AvailabilityRow[];
  verifications: VerificationRow[];
  images: ImageMeta[];
  seoTitle: string | null;
  seoDescription: string | null;
};
