import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { ToolRunner } from "./types";

const execAsync = promisify(exec);

export const gitInputSchema = z.object({
  action: z.enum(["status", "diff", "log"]),
  args: z.array(z.string()).default([])
});

export type GitInput = z.infer<typeof gitInputSchema>;

const SAFE_ACTION_COMMAND: Record<GitInput["action"], string> = {
  status: "git status --short --branch",
  diff: "git diff --stat",
  log: "git log --oneline -n 5"
};

export const gitTool: ToolRunner<GitInput> = {
  async execute(input, context) {
    const parsed = gitInputSchema.parse(input);
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
    } catch (error) {
      const err = error as Error & { stdout?: string; stderr?: string };
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
