import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { AgentService } from "../src/core/agent-service";
import type { AgentRequest, AgentStep } from "../src/shared/types";
import type { ModelProvider, ProviderPlan } from "../src/core/provider";
import { ToolGateway } from "../src/core/tools/tool-gateway";
import { SessionStore } from "../src/core/persistence/session-store";

class TestProvider implements ModelProvider {
  async planTask(): Promise<ProviderPlan> {
    return {
      thought: "Run one smoke command.",
      commands: ["echo integration-pass"],
      patchSuggestion: "No code patch required for this test."
    };
  }

  async summarize(request: AgentRequest): Promise<string> {
    return `Summary for: ${request.task}`;
  }
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("AgentService integration", () => {
  it("streams step lifecycle and produces final summary", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "welcode-agent-"));
    tempDirs.push(root);
    const workspace = path.join(root, "workspace");

    const store = new SessionStore(root);
    const session = store.createSession(workspace);
    const service = new AgentService(() => new TestProvider(), new ToolGateway(), store);
    const seenSteps: AgentStep[] = [];

    const result = await service.run(
      session.sessionId,
      {
        task: "Run integration smoke",
        workspacePath: workspace,
        approvalMode: "sandbox"
      },
      {
        onStep: (step) => seenSteps.push(step),
        requestApproval: async () => true
      },
      "run-int"
    );

    expect(result.success).toBe(true);
    expect(result.summary).toContain("Run integration smoke");
    expect(seenSteps.map((step) => step.type)).toEqual([
      "think",
      "tool_call",
      "tool_result",
      "patch",
      "summary"
    ]);
  });

  it("marks tool result blocked when approval rejected", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "welcode-agent-block-"));
    tempDirs.push(root);
    const workspace = path.join(root, "workspace");

    const store = new SessionStore(root);
    const session = store.createSession(workspace);
    const provider: ModelProvider = {
      planTask: async () => ({
        thought: "Try risky command",
        commands: ["git reset --hard"],
        patchSuggestion: "N/A"
      }),
      summarize: async () => "blocked summary"
    };

    const service = new AgentService(() => provider, new ToolGateway(), store);
    const seenSteps: AgentStep[] = [];

    await service.run(
      session.sessionId,
      {
        task: "Risky run",
        workspacePath: workspace,
        approvalMode: "sandbox"
      },
      {
        onStep: (step) => seenSteps.push(step),
        requestApproval: async () => false
      },
      "run-block"
    );

    const toolResult = seenSteps.find((step) => step.type === "tool_result");
    expect(toolResult?.status).toBe("blocked");
  });
});
