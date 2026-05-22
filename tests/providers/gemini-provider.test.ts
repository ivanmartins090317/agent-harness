import { describe, expect, it } from "vitest";
import { createGeminiProvider } from "../../src/providers/gemini-provider.js";

describe("gemini-provider", () => {
  it("ainda não implementado", async () => {
    const provider = createGeminiProvider();
    await expect(
      provider.generate({
        system: "",
        messages: [],
        tools: [],
        phase: "plan",
      }),
    ).rejects.toThrow(/ainda não implementado/);
  });
});
