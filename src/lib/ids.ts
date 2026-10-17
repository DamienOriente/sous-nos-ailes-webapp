import { randomBytes, randomInt } from "node:crypto";

// Unambiguous alphabet (no 0/O, 1/I/L) for codes humans may read or type.
const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function generateReadableCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

export function generateSubmissionKey(): string {
  return randomBytes(16).toString("base64url");
}
