"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
const node_crypto_1 = require("node:crypto");
const audit_1 = require("./audit");
class AgentService {
    providerFactory;
    toolGateway;
    sessionStore;
    constructor(providerFactory, toolGateway, sessionStore) {
        this.providerFactory = providerFactory;
        this.toolGateway = toolGateway;
        this.sessionStore = sessionStore;
    }
    listSessions() {
        return this.sessionStore.listSessions();
    }
    createSession(workspacePath) {
        return this.sessionStore.createSession(workspacePath);
    }
    async run(sessionId, request, callbacks, runId) {
        const provider = this.providerFactory();
        const approvalMode = request.approvalMode ?? "sandbox";
        const steps = [];
        const toolOutputs = [];
        const auditLogger = new audit_1.AuditLogger(request.workspacePath);
        this.sessionStore.appendMessage(sessionId, { role: "user", content: request.task });
        const plan = await provider.planTask(request);
        this.pushStep(steps, callbacks.onStep, "think", "completed", { thought: plan.thought, commands: plan.commands, availableTools: this.toolGateway.getToolSpecs() });
        for (const command of plan.commands) {
            this.pushStep(steps, callbacks.onStep, "tool_call", "in_progress", {
                tool: "shell",
                command
            });
            const result = await this.toolGateway.invoke({ name: "shell", input: { command, cwd: request.workspacePath } }, { workspacePath: request.workspacePath, auditLogger }, { requestApproval: callbacks.requestApproval }, runId, approvalMode);
            const status = result.ok ? "completed" : result.error === "approval_denied" ? "blocked" : "failed";
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
    pushStep(bucket, emit, type, status, payload) {
        const step = {
            id: (0, node_crypto_1.randomUUID)(),
            type,
            status,
            timestamp: new Date().toISOString(),
            payload
        };
        bucket.push(step);
        emit(step);
    }
}
exports.AgentService = AgentService;
