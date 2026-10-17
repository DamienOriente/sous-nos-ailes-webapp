/**
 * One-shot feedback carried through the URL after a redirecting Server Action
 * (`?message=` / `?error=`). Values are rendered as text only and truncated.
 */
export type FlashInput = { message?: string; error?: string };

const MAX_LENGTH = 300;

export function flashQuery(input: FlashInput): string {
  const params = new URLSearchParams();
  if (input.message) params.set("message", input.message.slice(0, MAX_LENGTH));
  if (input.error) params.set("error", input.error.slice(0, MAX_LENGTH));
  return params.toString();
}

export function readFlash(query: Record<string, string | string[] | undefined>): FlashInput {
  const pick = (key: string): string | undefined => {
    const raw = query[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ? value.slice(0, MAX_LENGTH) : undefined;
  };
  return { message: pick("message"), error: pick("error") };
}
