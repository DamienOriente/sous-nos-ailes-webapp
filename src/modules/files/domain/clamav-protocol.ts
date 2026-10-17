/**
 * clamd zINSTREAM protocol helpers (pure). The socket handling lives in
 * infrastructure/clamav.ts; these functions build frames and parse replies.
 */
export const CLAMAV_CHUNK_SIZE = 64 * 1024;

export type ClamVerdict = { verdict: "clean" } | { verdict: "infected"; signature: string } | { verdict: "error"; message: string };

/** 4-byte big-endian length prefix as required by INSTREAM. */
export function lengthPrefix(size: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, size, false);
  return b;
}

/** Splits a payload into INSTREAM frames, terminated by the zero-length frame. */
export function* instreamFrames(payload: Uint8Array, chunkSize = CLAMAV_CHUNK_SIZE): Generator<Uint8Array> {
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.subarray(i, Math.min(i + chunkSize, payload.length));
    yield lengthPrefix(chunk.length);
    yield chunk;
  }
  yield lengthPrefix(0);
}

/**
 * Replies look like "stream: OK", "stream: Eicar-Test-Signature FOUND",
 * "stream: Win.Test.EICAR_HDB-1 FOUND" or "INSTREAM size limit exceeded. ERROR".
 * With the z-prefixed command the reply is NUL-terminated.
 */
export function parseClamReply(raw: string): ClamVerdict {
  const reply = raw.replace(/\0+$/g, "").trim();
  if (reply === "") return { verdict: "error", message: "empty reply from clamd" };
  if (/\bOK$/.test(reply)) return { verdict: "clean" };
  const found = /^(?:stream|[^:]*):\s*(.+?)\s+FOUND$/.exec(reply);
  if (found?.[1]) return { verdict: "infected", signature: found[1] };
  if (/ERROR$/.test(reply)) return { verdict: "error", message: reply };
  return { verdict: "error", message: `unexpected reply: ${reply.slice(0, 120)}` };
}
