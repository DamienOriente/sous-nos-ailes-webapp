import { describe, expect, it } from "vitest";
import { TOOL_SEED } from "@/modules/tools/domain/tool-catalogue";
import { TOOL_EXAMPLES, toolExample, toolsWithoutExample } from "@/modules/tools/domain/tool-examples";

describe("tool examples", () => {
  it("every seeded tool has a concrete example and an outcome", () => {
    expect(toolsWithoutExample()).toEqual([]);
    for (const tool of TOOL_SEED) {
      const ex = toolExample(tool.key);
      expect(ex, tool.key).not.toBeNull();
      expect(ex!.example.length, tool.key).toBeGreaterThan(20);
      expect(ex!.outcome.length, tool.key).toBeGreaterThan(20);
    }
  });

  it("does not reference unknown tools", () => {
    const keys = new Set(TOOL_SEED.map((t) => t.key));
    for (const key of Object.keys(TOOL_EXAMPLES)) expect(keys.has(key), key).toBe(true);
  });

  it("returns null for an unknown tool", () => {
    expect(toolExample("nope")).toBeNull();
  });
});
