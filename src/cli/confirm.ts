import { confirm } from "@inquirer/prompts";
import pc from "picocolors";
import type { ConfirmFn } from "../engine/loop.js";

export interface ConfirmOptions {
  autoApprove: boolean;
}

export function createConfirmFn(opts: ConfirmOptions): ConfirmFn {
  return async (toolName, input) => {
    if (opts.autoApprove) return true;
    const preview = previewInput(input);
    console.log(pc.yellow(`\n⚠  Ferramenta perigosa solicitada: ${toolName}`));
    console.log(pc.gray(preview));
    try {
      return await confirm({
        message: `Autorizar execução de ${toolName}?`,
        default: false,
      });
    } catch {
      return false;
    }
  };
}

function previewInput(input: unknown): string {
  try {
    const str = JSON.stringify(input, null, 2);
    if (str.length <= 1000) return str;
    return `${str.slice(0, 1000)}\n...[truncado]`;
  } catch {
    return String(input);
  }
}
