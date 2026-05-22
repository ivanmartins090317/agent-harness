import { describe, expect, it } from "vitest";
import { createRouter } from "../../src/engine/router.js";
import type { LLMProvider } from "../../src/providers/llm-provider.js";

function provider(name: string): LLMProvider {
  return {
    name,
    async generate() {
      throw new Error("not used");
    },
  };
}

describe("router", () => {
  it("escolhe plan/exec corretamente", () => {
    const plan = provider("p");
    const exec = provider("e");
    const router = createRouter({ plan, exec });
    expect(router.pick("plan").name).toBe("p");
    expect(router.pick("exec").name).toBe("e");
  });
});
