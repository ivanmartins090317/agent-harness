import type { z } from "zod";

export interface ToolContext {
  projectPath: string;
  taskId: string;
  logger: ToolLogger;
  abortSignal?: AbortSignal;
}

export interface ToolLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface Tool<I = unknown, O = unknown> {
  name: string;
  description: string;
  dangerous: boolean;
  schema: z.ZodType<I>;
  run: (input: I, ctx: ToolContext) => Promise<O>;
}

export interface ToolInvocationResult {
  ok: boolean;
  output?: unknown;
  error?: string;
  rejected?: boolean;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  dangerous: boolean;
  inputSchema: Record<string, unknown>;
}
