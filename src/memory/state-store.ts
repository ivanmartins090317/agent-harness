import type { AgentDecision, AgentState, AgentStatus } from "../engine/types.js";
import { pathExists, readJson, writeJson } from "../utils/fs.js";
import { stateFile } from "./paths.js";

export async function loadState(
  projectPath: string,
  taskId: string,
): Promise<AgentState> {
  const file = stateFile(projectPath, taskId);
  if (await pathExists(file)) {
    return readJson<AgentState>(file);
  }
  return {
    taskId,
    status: "pending",
    lastStep: 0,
    decisions: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function saveState(
  projectPath: string,
  state: AgentState,
): Promise<void> {
  const next: AgentState = { ...state, updatedAt: new Date().toISOString() };
  await writeJson(stateFile(projectPath, state.taskId), next);
}

export async function updateStatus(
  projectPath: string,
  taskId: string,
  status: AgentStatus,
): Promise<AgentState> {
  const state = await loadState(projectPath, taskId);
  state.status = status;
  await saveState(projectPath, state);
  return state;
}

export async function recordDecision(
  projectPath: string,
  taskId: string,
  step: number,
  text: string,
): Promise<AgentState> {
  const state = await loadState(projectPath, taskId);
  const decision: AgentDecision = {
    at: new Date().toISOString(),
    step,
    text,
  };
  state.decisions.push(decision);
  state.lastStep = step;
  await saveState(projectPath, state);
  return state;
}
