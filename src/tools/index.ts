import { ToolRegistry } from "./registry.js";
import { readFileTool } from "./read-file.js";
import { writeFileTool } from "./write-file.js";
import { editFileTool } from "./edit-file.js";
import { searchTextTool } from "./search-text.js";
import { runTerminalTool } from "./run-terminal.js";
import { gitStatusTool } from "./git-status.js";
import { gitDiffTool } from "./git-diff.js";

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(editFileTool);
  registry.register(searchTextTool);
  registry.register(runTerminalTool);
  registry.register(gitStatusTool);
  registry.register(gitDiffTool);
  return registry;
}

export { ToolRegistry };
export {
  readFileTool,
  writeFileTool,
  editFileTool,
  searchTextTool,
  runTerminalTool,
  gitStatusTool,
  gitDiffTool,
};
