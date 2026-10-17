import { describe, expect, it } from "vitest";
import { instreamFrames, lengthPrefix, parseClamReply } from "@/modules/files/domain/clamav-protocol";

describe("clamd INSTREAM framing", () => {
  it("writes big-endian length prefixes", () => {
    expect([...lengthPrefix(0)]).toEqual([0, 0, 0, 0]);
    expect([...lengthPrefix(65536)]).toEqual([0, 1, 0, 0]);
    expect([...lengthPrefix(258)]).toEqual([0, 0, 1, 2]);
  });
  it("chunks the payload and terminates with a zero-length frame", () => {
    const payload = new Uint8Array(10).fill(7);
    const frames = [...instreamFrames(payload, 4)];
    // 3 chunks (4,4,2) → 6 frames + final zero prefix
    expect(frames).toHaveLength(7);
    expect([...frames[0]!]).toEqual([0, 0, 0, 4]);
    expect(frames[1]).toHaveLength(4);
    expect([...frames[4]!]).toEqual([0, 0, 0, 2]);
    expect([...frames[6]!]).toEqual([0, 0, 0, 0]);
  });
});

describe("clamd reply parsing", () => {
  it("parses OK", () => {
    expect(parseClamReply("stream: OK\0")).toEqual({ verdict: "clean" });
    expect(parseClamReply("stream: OK\n")).toEqual({ verdict: "clean" });
  });
  it("parses FOUND with the signature name", () => {
    expect(parseClamReply("stream: Eicar-Test-Signature FOUND\0")).toEqual({ verdict: "infected", signature: "Eicar-Test-Signature" });
    expect(parseClamReply("stream: Win.Test.EICAR_HDB-1 FOUND")).toEqual({ verdict: "infected", signature: "Win.Test.EICAR_HDB-1" });
  });
  it("parses errors and garbage as error", () => {
    expect(parseClamReply("INSTREAM size limit exceeded. ERROR\0")).toMatchObject({ verdict: "error" });
    expect(parseClamReply("")).toMatchObject({ verdict: "error" });
    expect(parseClamReply("something weird")).toMatchObject({ verdict: "error" });
  });
});
