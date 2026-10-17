// Text normalisation for user-provided content. Rendering always goes through
// React (escaped); these helpers only make stored text predictable.

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function normalizeText(value: string): string {
  return value.replace(CONTROL_CHARS, "").replace(/\r\n?/g, "\n").trim();
}

export function normalizeSingleLine(value: string): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

export function normalizeEmail(value: string): string {
  return normalizeSingleLine(value).toLowerCase();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
