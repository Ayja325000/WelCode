"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolGateway = void 0;
const risk_1 = require("../risk");
const shell_tool_1 = require("./shell-tool");
const fs_tool_1 = require("./fs-tool");
const git_tool_1 = require("./git-tool");
const toolSpecs = {
    shell: { name: "shell", schema: "ShellInput", riskLevel: "medium" },
    fs: { name: "fs", schema: "FsInput", riskLevel: "medium" },
    git: { name: "git", schema: "GitInput", riskLevel: "low" }
};
class ToolGateway {
    getToolSpecs() {
        return Object.values(toolSpecs);
    }
    async invoke(invocation, context, callbacks, runId, approvalMode) {
        if (invocation.name === "shell") {
            const parsed = shell_tool_1.shellInputSchema.parse(invocation.input);
            const command = parsed.command;
            const risk = (0, risk_1.assessCommandRisk)(command);
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
            return shell_tool_1.shellTool.execute(parsed, context);
        }
        if (invocation.name === "fs") {
            const parsed = fs_tool_1.fsInputSchema.parse(invocation.input);
            return fs_tool_1.fsTool.execute(parsed, context);
        }
        const parsed = git_tool_1.gitInputSchema.parse(invocation.input);
        return git_tool_1.gitTool.execute(parsed, context);
    }
}
exports.ToolGateway = ToolGateway;
