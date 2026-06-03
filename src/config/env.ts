import "dotenv/config";

export type ProviderName = "anthropic" | "openrouter";

export interface AgentEnv {
  anthropicApiKey: string | undefined;
  openrouterApiKey: string | undefined;
  planProvider: ProviderName;
  execProvider: ProviderName;
  planModel: string;
  execModel: string;
  maxSteps: number;
  terminalTimeoutMs: number;
}

const DEFAULT_PLAN_PROVIDER: ProviderName = "anthropic";
const DEFAULT_EXEC_PROVIDER: ProviderName = "anthropic";
const DEFAULT_PLAN_MODEL = "claude-opus-4-20250514";
const DEFAULT_EXEC_MODEL = "claude-opus-4-20250514";
const DEFAULT_MAX_STEPS = 30;
const DEFAULT_TERMINAL_TIMEOUT_MS = 120_000;

export function loadEnv(): AgentEnv {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    planProvider: parseProvider(process.env.AGENT_PLAN_PROVIDER, DEFAULT_PLAN_PROVIDER),
    execProvider: parseProvider(process.env.AGENT_EXEC_PROVIDER, DEFAULT_EXEC_PROVIDER),
    planModel: process.env.AGENT_PLAN_MODEL ?? DEFAULT_PLAN_MODEL,
    execModel: process.env.AGENT_EXEC_MODEL ?? DEFAULT_EXEC_MODEL,
    maxSteps: parseIntOrDefault(process.env.AGENT_MAX_STEPS, DEFAULT_MAX_STEPS),
    terminalTimeoutMs: parseIntOrDefault(
      process.env.AGENT_TERMINAL_TIMEOUT_MS,
      DEFAULT_TERMINAL_TIMEOUT_MS,
    ),
  };
}

function parseProvider(value: string | undefined, fallback: ProviderName): ProviderName {
  if (value === "anthropic" || value === "openrouter") return value;
  return fallback;
}

function parseIntOrDefault(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
