"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gitTool = exports.gitInputSchema = void 0;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const zod_1 = require("zod");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
exports.gitInputSchema = zod_1.z.object({
    action: zod_1.z.enum(["status", "diff", "log"]),
    args: zod_1.z.array(zod_1.z.string()).default([])
});
const SAFE_ACTION_COMMAND = {
    status: "git status --short --branch",
    diff: "git diff --stat",
    log: "git log --oneline -n 5"
};
exports.gitTool = {
    async execute(input, context) {
        const parsed = exports.gitInputSchema.parse(input);
        const command = `${SAFE_ACTION_COMMAND[parsed.action]} ${parsed.args.join(" ")}`.trim();
        const start = Date.now();
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: context.workspacePath,
                windowsHide: true,
                shell: "powershell.exe"
            });
            const output = [stdout, stderr].filter(Boolean).join("\n").trim();
            context.auditLogger.write({
                timestamp: new Date().toISOString(),
                tool: "git",
                input: parsed,
                success: true,
                durationMs: Date.now() - start,
                outputPreview: output.slice(0, 1_000)
            });
            return { ok: true, output };
        }
        catch (error) {
            const err = error;
            const output = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
            context.auditLogger.write({
                timestamp: new Date().toISOString(),
                tool: "git",
                input: parsed,
                success: false,
                durationMs: Date.now() - start,
                outputPreview: output.slice(0, 1_000),
                error: err.message
            });
            return { ok: false, output, error: err.message };
        }
    }
};
