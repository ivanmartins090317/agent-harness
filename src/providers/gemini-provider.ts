import type { LLMRequest, LLMResponse } from "../engine/types.js";
import type { LLMProvider } from "./llm-provider.js";

export function createGeminiProvider(): LLMProvider {
  return {
    name: "gemini",
    async generate(_req: LLMRequest): Promise<LLMResponse> {
      throw new Error(
        "Gemini provider ainda não implementado. Use o provider Anthropic ou implemente createGeminiProvider().",
      );
    },
  };
}
