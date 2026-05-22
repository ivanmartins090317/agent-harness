import type { AgentPhase } from "./types.js";
import type { LLMProvider } from "../providers/llm-provider.js";

export interface RouterConfig {
  plan: LLMProvider;
  exec: LLMProvider;
}

export interface Router {
  pick(phase: AgentPhase): LLMProvider;
}

export function createRouter(config: RouterConfig): Router {
  return {
    pick(phase) {
      return phase === "plan" ? config.plan : config.exec;
    },
  };
}
