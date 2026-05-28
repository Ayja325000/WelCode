import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it, afterEach } from "vitest";
import { ToolGateway } from "../src/core/tools/tool-gateway";
import { AuditLogger } from "../src/core/audit";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createContext(): { workspacePath: string; auditLogger: AuditLogger } {
  const workspacePath = mkdtempSync(path.join(os.tmpdir(), "welcode-tools-"));
  tempDirs.push(workspacePath);
  return { workspacePath, auditLogger: new AuditLogger(workspacePath) };
}

describe("ToolGateway", () => {
  it("blocks high-risk shell command when approval is denied", async () => {
    const gateway = new ToolGateway();
    const context = createContext();
    const result = await gateway.invoke(
      { name: "shell", input: { command: "git reset --hard" } },
      context,
      {
        requestApproval: async () => false
      },
      "run-test",
      "sandbox"
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("approval_denied");
  });

  it("runs low-risk shell command when approved", async () => {
    const gateway = new ToolGateway();
    const context = createContext();
    const result = await gateway.invoke(
      { name: "shell", input: { command: "echo hello from test" } },
      context,
      {
        requestApproval: async () => true
      },
      "run-test",
      "sandbox"
    );

    expect(result.ok).toBe(true);
    expect(result.output.toLowerCase().replace(/\s+/g, " ").trim()).toContain("hello from test");
  });
});
