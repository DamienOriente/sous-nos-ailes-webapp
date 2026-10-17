/**
 * Pure normalisation helpers shared by contacts and guests. No IO.
 */
export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (!v) return null;
  // Deliberately permissive: a single "@" with something on both sides and a dot in the domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

/**
 * French-first E.164 normalisation. Accepts "06 12 34 56 78", "06.12.34.56.78",
 * "+33 6 12 34 56 78", "0033612345678", "(0)6 12…". Other international numbers
 * are kept when they already start with "+" and look plausible.
 */
export function normalizePhoneFr(input: string | null | undefined): string | null {
  if (!input) return null;
  let v = input.replace(/\(0\)/g, "").replace(/[\s.\-()]/g, "");
  if (!v) return null;
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  if (v.startsWith("+33")) {
    const rest = v.slice(3).replace(/^0/, "");
    return /^[1-9]\d{8}$/.test(rest) ? `+33${rest}` : null;
  }
  if (v.startsWith("+")) {
    return /^\+[1-9]\d{6,14}$/.test(v) ? v : null;
  }
  if (/^0[1-9]\d{8}$/.test(v)) return `+33${v.slice(1)}`;
  return null;
}

/** lower(email) when present, otherwise the E.164 phone. Null when neither is usable. */
export function computeDedupeKey(input: { email?: string | null; phone?: string | null }): string | null {
  const email = normalizeEmail(input.email);
  if (email) return `email:${email}`;
  const phone = normalizePhoneFr(input.phone);
  if (phone) return `phone:${phone}`;
  return null;
}

/** "jean dupont" → "Jean Dupont" for display of imported names. Keeps existing capitals. */
export function titleCaseName(input: string): string {
  const t = input.trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t !== t.toLowerCase()) return t;
  return t
    .split(/(\s|-)/)
    .map((p) => (p.length > 0 && p !== " " && p !== "-" ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join("");
}
