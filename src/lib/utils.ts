export { cn } from "cn";

/** URL-safe slug from a French label ("Garde d'enfants évènementielle" → "garde-d-enfants-evenementielle"). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function formatDateFr(date: Date | string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }, timeZone = "Europe/Paris"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone }).format(d);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}
