import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";

const KEYS = [
  "ANTHROPIC_API_KEY",
  "AGENT_PLAN_MODEL",
  "AGENT_EXEC_MODEL",
  "AGENT_MAX_STEPS",
  "AGENT_TERMINAL_TIMEOUT_MS",
];

describe("loadEnv", () => {
  let backup: Record<string, string | undefined>;

  beforeEach(() => {
    backup = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (backup[k] === undefined) delete process.env[k];
      else process.env[k] = backup[k];
    }
  });

  it("usa valores default quando env vazio", () => {
    const env = loadEnv();
    expect(env.anthropicApiKey).toBeUndefined();
    expect(env.planModel).toMatch(/claude/);
    expect(env.maxSteps).toBeGreaterThan(0);
    expect(env.terminalTimeoutMs).toBeGreaterThan(0);
  });

  it("respeita overrides numéricos válidos", () => {
    process.env.AGENT_MAX_STEPS = "7";
    process.env.AGENT_TERMINAL_TIMEOUT_MS = "5000";
    const env = loadEnv();
    expect(env.maxSteps).toBe(7);
    expect(env.terminalTimeoutMs).toBe(5000);
  });

  it("ignora valores numéricos inválidos", () => {
    process.env.AGENT_MAX_STEPS = "abc";
    const env = loadEnv();
    expect(env.maxSteps).toBeGreaterThan(0);
  });
});
