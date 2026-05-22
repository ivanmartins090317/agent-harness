import type { ToolDescriptor } from "../tools/types.js";

export type AgentPhase = "plan" | "exec";

export type AgentStatus = "pending" | "running" | "completed" | "failed";

export interface AgentTask {
  taskId: string;
  projectPath: string;
  tdd: string;
}

export interface AgentDecision {
  at: string;
  step: number;
  text: string;
}

export interface AgentState {
  taskId: string;
  status: AgentStatus;
  lastStep: number;
  decisions: AgentDecision[];
  updatedAt: string;
}

export type ChatRole = "user" | "assistant";

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface ChatMessage {
  role: ChatRole;
  content: ContentBlock[];
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "error";

export interface LLMResponse {
  stopReason: StopReason;
  content: ContentBlock[];
  raw?: unknown;
}

export interface LLMRequest {
  system: string;
  messages: ChatMessage[];
  tools: ToolDescriptor[];
  phase: AgentPhase;
  maxTokens?: number;
}

export interface ValidationCheckResult {
  name: string;
  ran: boolean;
  ok: boolean;
  durationMs: number;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  skippedReason?: string;
}

export interface ValidationReport {
  ok: boolean;
  checks: ValidationCheckResult[];
}

export interface RunResult {
  taskId: string;
  status: AgentStatus;
  steps: number;
  durationMs: number;
  validation?: ValidationReport;
  summary: string;
}
