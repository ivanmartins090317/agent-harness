import type { LLMRequest, LLMResponse } from "../engine/types.js";

export interface LLMProvider {
  name: string;
  generate(req: LLMRequest): Promise<LLMResponse>;
}
