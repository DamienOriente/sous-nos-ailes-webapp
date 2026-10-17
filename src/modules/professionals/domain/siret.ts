/**
 * SIREN (9 digits) / SIRET (14 digits) syntactic validation with the Luhn
 * checksum. This only proves the number is well formed: the business
 * registration itself is checked by a moderator (verification kind
 * "business_registration_checked"), never claimed automatically.
 */
export function normalizeSiret(input: string): string {
  return input.replace(/[\s.-]/g, "");
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const d = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (d < 0 || d > 9) return false;
    let v = d;
    if (i % 2 === 1) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
  }
  return sum % 10 === 0;
}

export function isValidSiren(input: string): boolean {
  const s = normalizeSiret(input);
  return /^\d{9}$/.test(s) && luhnValid(s);
}

export function isValidSiret(input: string): boolean {
  const s = normalizeSiret(input);
  return /^\d{14}$/.test(s) && luhnValid(s);
}

/** SIREN is the first 9 digits of the SIRET. */
export function sirenFromSiret(siret: string): string {
  return normalizeSiret(siret).slice(0, 9);
}
