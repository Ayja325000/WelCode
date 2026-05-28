import type { AuditLogger } from "../audit";

export interface ToolExecutionContext {
  workspacePath: string;
  auditLogger: AuditLogger;
}

export interface ToolExecutionResult {
  ok: boolean;
  output: string;
  exitCode?: number;
  error?: string;
}

export interface ToolRunner<TInput> {
  execute: (input: TInput, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}
