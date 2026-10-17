/**
 * `@Prénom` / `@Prénom Nom` mentions are resolved server side against the
 * member list so the client never sends user ids. Pure.
 */
export type MentionCandidate = { userId: string; name: string };

function normalise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const MENTION_RE = /(?:^|\s)@([\p{L}'’-]+)(?:\s([\p{L}'’-]+))?/gu;

/** Raw mention tokens: the word right after "@" (the optional second word is only used during resolution). */
export function extractMentionTokens(body: string): string[] {
  const tokens: string[] = [];
  for (const m of body.matchAll(MENTION_RE)) if (m[1]) tokens.push(m[1]);
  return tokens;
}

/**
 * Resolves mentions to member user ids. "@Prénom Nom" matches the full name
 * when it exists; otherwise "@Prénom" matches every member with that first
 * name (ambiguity is visible to the author, who sees who was notified).
 */
export function resolveMentions(body: string, candidates: readonly MentionCandidate[]): string[] {
  const found = new Set<string>();
  const indexed = candidates.map((c) => {
    const full = normalise(c.name);
    return { ...c, full, first: full.split(/\s+/)[0] ?? "" };
  });
  for (const m of body.matchAll(MENTION_RE)) {
    const first = normalise(m[1] ?? "");
    const second = m[2] ? normalise(m[2]) : null;
    if (!first) continue;
    const fullMatch = second ? indexed.filter((c) => c.full === `${first} ${second}`) : [];
    if (fullMatch.length) {
      for (const c of fullMatch) found.add(c.userId);
      continue;
    }
    for (const c of indexed) if (c.first === first || c.full === first) found.add(c.userId);
  }
  return [...found];
}
