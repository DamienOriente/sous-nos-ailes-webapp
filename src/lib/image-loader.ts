/**
 * next/image loader for our own files API (/api/files/<id>/public?v=...).
 * Picks the stored WebP variant closest to the requested width (thumb 320, card 640, medium 1024,
 * large 1920; a phone asking 828 gets card, 3% soft at most). The route streams the bytes with a
 * long cache, so nothing is re-encoded by the Next optimizer. Other sources (Unsplash demo photos)
 * keep the default optimizer: same origin as the page, no extra DNS/TLS handshake on slow phones.
 */
export function filesImageLoader({ src, width }: { src: string; width: number }): string {
  const variant = width <= 320 ? "thumb" : width <= 830 ? "card" : width <= 1200 ? "medium" : "large";
  return src.replace(/([?&])v=[a-z]+/, `$1v=${variant}`);
}
