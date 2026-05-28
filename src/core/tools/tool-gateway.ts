import type { ApprovalMode, ApprovalRequest, ToolSpec } from "../../shared/types";
import { assessCommandRisk } from "../risk";
import type { ToolExecutionContext, ToolExecutionResult } from "./types";
import { shellInputSchema, shellTool, type ShellInput } from "./shell-tool";
import { fsInputSchema, fsTool, type FsInput } from "./fs-tool";
import { gitInputSchema, gitTool, type GitInput } from "./git-tool";

export type ToolName = "shell" | "fs" | "git";

export interface ToolInvocation {
  name: ToolName;
  input: unknown;
}

export interface ToolGatewayCallbacks {
  requestApproval: (request: ApprovalRequest) => Promise<boolean>;
}

const toolSpecs: Record<ToolName, ToolSpec> = {
  shell: { name: "shell", schema: "ShellInput", riskLevel: "medium" },
  fs: { name: "fs", schema: "FsInput", riskLevel: "medium" },
  git: { name: "git", schema: "GitInput", riskLevel: "low" }
};

export class ToolGateway {
  getToolSpecs(): ToolSpec[] {
    return Object.values(toolSpecs);
  }

  async invoke(
    invocation: ToolInvocation,
    context: ToolExecutionContext,
    callbacks: ToolGatewayCallbacks,
    runId: string,
    approvalMode: ApprovalMode
  ): Promise<ToolExecutionResult> {
    if (invocation.name === "shell") {
      const parsed: ShellInput = shellInputSchema.parse(invocation.input);
      const command = (parsed as { command: string }).command;
      const risk = assessCommandRisk(command);
      if (risk.requiresApproval || approvalMode === "manual") {
        const approved = await callbacks.requestApproval({
          runId,
          approvalId: crypto.randomUUID(),
          command,
          riskReason: risk.reason,
          requiresUserConfirm: true
        });
        if (!approved) {
          return { ok: false, output: "Command was blocked by user approval.", error: "approval_denied" };
        }
      }
      return shellTool.execute(parsed, context);
    }

    if (invocation.name === "fs") {
      const parsed: FsInput = fsInputSchema.parse(invocation.input);
      return fsTool.execute(parsed, context);
    }

    const parsed: GitInput = gitInputSchema.parse(invocation.input);
    return gitTool.execute(parsed, context);
  }
}
