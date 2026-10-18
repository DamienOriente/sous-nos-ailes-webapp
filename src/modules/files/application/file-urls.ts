/**
 * CONTRACT — implemented by the files module (routes under /api/files).
 * Other modules only need these two helpers to reference files.
 */

/** Authenticated download/view: the route checks the actor's access to the file scope and redirects to a short-lived signed URL. */
export function privateFileHref(fileId: string, opts?: { download?: boolean }): string {
  return `/api/files/${fileId}${opts?.download ? "?download=1" : ""}`;
}

/**
 * Public rendition of an image that belongs to a published page / directory
 * card. The route only serves files whose purpose is public (logo, cover,
 * gallery) and whose owning listing is published.
 */
export type ImageVariant = "thumb" | "card" | "medium" | "large" | "original";
export function publicImageHref(fileId: string, variant: ImageVariant = "medium"): string {
  return `/api/files/${fileId}/public?v=${variant}`;
}
