import { describe, expect, it } from "vitest";
import { extractMentionTokens, resolveMentions } from "@/modules/collaboration/domain/mentions";

const members = [
  { userId: "u-marie", name: "Marie Delcourt" },
  { userId: "u-helene", name: "Hélène Vasseur" },
  { userId: "u-camille", name: "Camille Ferrand" },
  { userId: "u-marie2", name: "Marie Dupont" },
];

describe("mentions", () => {
  it("extracts tokens", () => {
    expect(extractMentionTokens("Hello @Marie et @Hélène Vasseur, ok ?")).toEqual(["Marie", "Hélène"]);
    expect(extractMentionTokens("mail@example.com is not a mention")).toEqual([]);
  });
  it("resolves first names case/accent-insensitively", () => {
    expect(resolveMentions("@helene peux-tu confirmer ?", members)).toEqual(["u-helene"]);
    expect(resolveMentions("Merci @CAMILLE", members)).toEqual(["u-camille"]);
  });
  it("resolves full names and ambiguous first names", () => {
    expect(resolveMentions("@Marie Dupont merci", members)).toEqual(["u-marie2"]);
    expect(resolveMentions("@Marie merci", members).sort()).toEqual(["u-marie", "u-marie2"]);
  });
  it("returns nothing for unknown names", () => {
    expect(resolveMentions("@Inconnu bonjour", members)).toEqual([]);
  });
});
