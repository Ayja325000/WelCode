import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { ToolRunner } from "./types";

const execAsync = promisify(exec);

export const shellInputSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().optional(),
  timeoutMs: z.number().int().positive().max(120_000).default(60_000)
});

export type ShellInput = z.infer<typeof shellInputSchema>;

function ensurePathInWorkspace(workspacePath: string, requestedCwd?: string): string {
  const resolvedWorkspace = path.resolve(workspacePath);
  const resolvedCwd = path.resolve(requestedCwd ?? workspacePath);
  const relative = path.relative(resolvedWorkspace, resolvedCwd);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Requested cwd '${resolvedCwd}' is outside workspace '${resolvedWorkspace}'.`);
  }
  return resolvedCwd;
}

export const shellTool: ToolRunner<ShellInput> = {
  async execute(input, context) {
    const start = Date.now();
    const parsed = shellInputSchema.parse(input);
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
    } catch (error) {
      const err = error as Error & { stdout?: string; stderr?: string; code?: number };
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
