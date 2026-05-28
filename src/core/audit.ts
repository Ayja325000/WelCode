import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface AuditEvent {
  timestamp: string;
  tool: string;
  input: unknown;
  success: boolean;
  durationMs: number;
  exitCode?: number;
  outputPreview?: string;
  error?: string;
}

export class AuditLogger {
  private readonly logFilePath: string;

  constructor(private readonly workspacePath: string) {
    const dir = path.join(workspacePath, ".welcode");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.logFilePath = path.join(dir, "audit.log");
  }

  write(event: AuditEvent): void {
    appendFileSync(this.logFilePath, `${JSON.stringify(event)}\n`, "utf-8");
  }
}
