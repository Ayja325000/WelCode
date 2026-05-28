import { randomUUID } from "node:crypto";
import type {
  AgentRequest,
  AgentRunResult,
  AgentStep,
  AgentStepStatus,
  AgentStepType,
  ApprovalMode,
  SessionState
} from "../shared/types";
import { AuditLogger } from "./audit";
import type { ModelProvider } from "./provider";
import { ToolGateway } from "./tools/tool-gateway";
import { SessionStore } from "./persistence/session-store";

export interface AgentCallbacks {
  onStep: (step: AgentStep) => void;
  requestApproval: (request: {
    runId: string;
    approvalId: string;
    command: string;
    riskReason: string;
    requiresUserConfirm: boolean;
  }) => Promise<boolean>;
}

export class AgentService {
  constructor(
    private readonly providerFactory: () => ModelProvider,
    private readonly toolGateway: ToolGateway,
    private readonly sessionStore: SessionStore
  ) {}

  listSessions(): SessionState[] {
    return this.sessionStore.listSessions();
  }

  createSession(workspacePath: string): SessionState {
    return this.sessionStore.createSession(workspacePath);
  }

  async run(sessionId: string, request: AgentRequest, callbacks: AgentCallbacks, runId: string): Promise<AgentRunResult> {
    const provider = this.providerFactory();
    const approvalMode: ApprovalMode = request.approvalMode ?? "sandbox";
    const steps: AgentStep[] = [];
    const toolOutputs: string[] = [];
    const auditLogger = new AuditLogger(request.workspacePath);

    this.sessionStore.appendMessage(sessionId, { role: "user", content: request.task });

    const plan = await provider.planTask(request);
    this.pushStep(
      steps,
      callbacks.onStep,
      "think",
      "completed",
      { thought: plan.thought, commands: plan.commands, availableTools: this.toolGateway.getToolSpecs() }
    );

    for (const command of plan.commands) {
      this.pushStep(steps, callbacks.onStep, "tool_call", "in_progress", {
        tool: "shell",
        command
      });

      const result = await this.toolGateway.invoke(
        { name: "shell", input: { command, cwd: request.workspacePath } },
        { workspacePath: request.workspacePath, auditLogger },
        { requestApproval: callbacks.requestApproval },
        runId,
        approvalMode
      );

      const status: AgentStepStatus = result.ok ? "completed" : result.error === "approval_denied" ? "blocked" : "failed";
      this.pushStep(steps, callbacks.onStep, "tool_result", status, {
        tool: "shell",
        command,
        exitCode: result.exitCode,
        output: result.output,
        error: result.error
      });

      if (result.output) {
        toolOutputs.push(result.output);
      }

      if (!result.ok && result.error !== "approval_denied") {
        break;
      }
    }

    this.pushStep(steps, callbacks.onStep, "patch", "completed", {
      suggestion: plan.patchSuggestion
    });

    const summary = await provider.summarize(request, toolOutputs);
    this.pushStep(steps, callbacks.onStep, "summary", "completed", { text: summary });

    this.sessionStore.appendMessage(sessionId, { role: "assistant", content: summary });
    this.sessionStore.updateWorkspaceMemory(sessionId, {
      lastTask: request.task,
      lastSummary: summary.slice(0, 500)
    });

    return {
      runId,
      summary,
      success: steps.every((step) => step.status !== "failed"),
      steps
    };
  }

  private pushStep(
    bucket: AgentStep[],
    emit: (step: AgentStep) => void,
    type: AgentStepType,
    status: AgentStepStatus,
    payload: Record<string, unknown>
  ): void {
    const step: AgentStep = {
      id: randomUUID(),
      type,
      status,
      timestamp: new Date().toISOString(),
      payload
    };
    bucket.push(step);
    emit(step);
  }
}
