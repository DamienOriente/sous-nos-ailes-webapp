import { CookieBanner } from "@/components/privacy/cookie-banner";

/**
 * Mount point for the cookie banner. To be inserted once in
 * `src/app/(public)/layout.tsx` (shared file, coordinator applies the diff);
 * until then every public page owned by the compliance module renders it.
 */
export function CookieBannerSlot() {
  return <CookieBanner />;
}
