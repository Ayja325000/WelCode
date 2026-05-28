"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shellTool = exports.shellInputSchema = void 0;
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
const node_util_1 = require("node:util");
const zod_1 = require("zod");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
exports.shellInputSchema = zod_1.z.object({
    command: zod_1.z.string().min(1),
    cwd: zod_1.z.string().optional(),
    timeoutMs: zod_1.z.number().int().positive().max(120_000).default(60_000)
});
function ensurePathInWorkspace(workspacePath, requestedCwd) {
    const resolvedWorkspace = node_path_1.default.resolve(workspacePath);
    const resolvedCwd = node_path_1.default.resolve(requestedCwd ?? workspacePath);
    const relative = node_path_1.default.relative(resolvedWorkspace, resolvedCwd);
    if (relative.startsWith("..") || node_path_1.default.isAbsolute(relative)) {
        throw new Error(`Requested cwd '${resolvedCwd}' is outside workspace '${resolvedWorkspace}'.`);
    }
    return resolvedCwd;
}
exports.shellTool = {
    async execute(input, context) {
        const start = Date.now();
        const parsed = exports.shellInputSchema.parse(input);
        const safeCwd = ensurePathInWorkspace(context.workspacePath, parsed.cwd);
        try {
            const { stdout, stderr } = await execAsync(parsed.command, {
                cwd: safeCwd,
                timeout: parsed.timeoutMs,
                windowsHide: true,
                shell: "powershell.exe"
            });
            const combinedOutput = [stdout, stderr].filter(Boolean).join("\n").trim();
            context.auditLogger.write({
                timestamp: new Date().toISOString(),
                tool: "shell",
                input: parsed,
                success: true,
                durationMs: Date.now() - start,
                exitCode: 0,
                outputPreview: combinedOutput.slice(0, 1_000)
            });
            return { ok: true, output: combinedOutput, exitCode: 0 };
        }
        catch (error) {
            const err = error;
            const output = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
            context.auditLogger.write({
                timestamp: new Date().toISOString(),
                tool: "shell",
                input: parsed,
                success: false,
                durationMs: Date.now() - start,
                exitCode: err.code,
                outputPreview: output.slice(0, 1_000),
                error: err.message
            });
            return {
                ok: false,
                output,
                error: err.message,
                exitCode: typeof err.code === "number" ? err.code : 1
            };
        }
    }
};
