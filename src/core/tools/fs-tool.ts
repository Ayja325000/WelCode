import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ToolRunner } from "./types";

export const fsInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("read"),
    filePath: z.string().min(1)
  }),
  z.object({
    action: z.literal("write"),
    filePath: z.string().min(1),
    content: z.string()
  }),
  z.object({
    action: z.literal("list"),
    dirPath: z.string().min(1)
  })
]);

export type FsInput = z.infer<typeof fsInputSchema>;

function resolveWithinWorkspace(workspacePath: string, targetPath: string): string {
  const root = path.resolve(workspacePath);
  const resolved = path.resolve(root, targetPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Target path is outside workspace.");
  }
  return resolved;
}

export const fsTool: ToolRunner<FsInput> = {
  async execute(input, context) {
    const parsed = fsInputSchema.parse(input);
    const start = Date.now();

    try {
      if (parsed.action === "read") {
        const fullPath = resolveWithinWorkspace(context.workspacePath, parsed.filePath);
        const content = await readFile(fullPath, "utf-8");
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
        await mkdir(path.dirname(fullPath), { recursive: true });
        await writeFile(fullPath, parsed.content, "utf-8");
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
      const files = await readdir(fullPath);
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
    } catch (error) {
      const err = error as Error;
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
