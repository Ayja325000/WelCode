"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fsTool = exports.fsInputSchema = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const zod_1 = require("zod");
exports.fsInputSchema = zod_1.z.discriminatedUnion("action", [
    zod_1.z.object({
        action: zod_1.z.literal("read"),
        filePath: zod_1.z.string().min(1)
    }),
    zod_1.z.object({
        action: zod_1.z.literal("write"),
        filePath: zod_1.z.string().min(1),
        content: zod_1.z.string()
    }),
    zod_1.z.object({
        action: zod_1.z.literal("list"),
        dirPath: zod_1.z.string().min(1)
    })
]);
function resolveWithinWorkspace(workspacePath, targetPath) {
    const root = node_path_1.default.resolve(workspacePath);
    const resolved = node_path_1.default.resolve(root, targetPath);
    const relative = node_path_1.default.relative(root, resolved);
    if (relative.startsWith("..") || node_path_1.default.isAbsolute(relative)) {
        throw new Error("Target path is outside workspace.");
    }
    return resolved;
}
exports.fsTool = {
    async execute(input, context) {
        const parsed = exports.fsInputSchema.parse(input);
        const start = Date.now();
        try {
            if (parsed.action === "read") {
                const fullPath = resolveWithinWorkspace(context.workspacePath, parsed.filePath);
                const content = await (0, promises_1.readFile)(fullPath, "utf-8");
                context.auditLogger.write({
                    timestamp: new Date().toISOString(),
                    tool: "fs",
                    input: parsed,
                    success: true,
                    durationMs: Date.now() - start,
                    outputPreview: content.slice(0, 1_000)
                });
                return { ok: true, output: content };
            }
            if (parsed.action === "write") {
                const fullPath = resolveWithinWorkspace(context.workspacePath, parsed.filePath);
                await (0, promises_1.mkdir)(node_path_1.default.dirname(fullPath), { recursive: true });
                await (0, promises_1.writeFile)(fullPath, parsed.content, "utf-8");
                const output = `Wrote ${parsed.content.length} bytes to ${parsed.filePath}`;
                context.auditLogger.write({
                    timestamp: new Date().toISOString(),
                    tool: "fs",
                    input: parsed,
                    success: true,
                    durationMs: Date.now() - start,
                    outputPreview: output
                });
                return { ok: true, output };
            }
            const fullPath = resolveWithinWorkspace(context.workspacePath, parsed.dirPath);
            const files = await (0, promises_1.readdir)(fullPath);
            const output = files.join("\n");
            context.auditLogger.write({
                timestamp: new Date().toISOString(),
                tool: "fs",
                input: parsed,
                success: true,
                durationMs: Date.now() - start,
                outputPreview: output.slice(0, 1_000)
            });
            return { ok: true, output };
        }
        catch (error) {
            const err = error;
            context.auditLogger.write({
                timestamp: new Date().toISOString(),
                tool: "fs",
                input: parsed,
                success: false,
                durationMs: Date.now() - start,
                error: err.message
            });
            return { ok: false, output: "", error: err.message };
        }
    }
};
