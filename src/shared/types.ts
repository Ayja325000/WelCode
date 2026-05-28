export type ApprovalMode = "sandbox" | "manual";

export interface AgentRequest {
  task: string;
  workspacePath: string;
  constraints?: string[];
  approvalMode?: ApprovalMode;
  model?: string;
}

export type AgentStepType = "think" | "tool_call" | "tool_result" | "patch" | "summary";
export type AgentStepStatus = "pending" | "in_progress" | "completed" | "failed" | "blocked";

export interface AgentStep {
  id: string;
  type: AgentStepType;
  status: AgentStepStatus;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface ToolSpec {
  name: string;
  schema: string;
  riskLevel: "low" | "medium" | "high";
}

export interface ApprovalRequest {
  runId: string;
  approvalId: string;
  command: string;
  riskReason: string;
  requiresUserConfirm: boolean;
}

export interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface SessionState {
  sessionId: string;
  workspacePath: string;
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
  workspaceMemory: Record<string, string>;
  artifacts: string[];
}

export interface AgentRunResult {
  runId: string;
  summary: string;
  success: boolean;
  steps: AgentStep[];
}

export interface AgentStepEvent {
  runId: string;
  step: AgentStep;
}

export interface AgentRunCompletedEvent {
  runId: string;
  result: AgentRunResult;
}

export interface ApprovalDecision {
  runId: string;
  approvalId: string;
  approved: boolean;
}

export interface RunAgentInput {
  sessionId: string;
  request: AgentRequest;
}

export interface CreateSessionInput {
  workspacePath: string;
}

export interface ProviderSettings {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
}

export interface IpcApi {
  getDefaultWorkspace: () => Promise<string>;
  getProviderSettings: () => Promise<ProviderSettings>;
  saveProviderSettings: (settings: ProviderSettings) => Promise<ProviderSettings>;
  openSessionStorageDir: (sessionId: string) => Promise<{ ok: boolean; message?: string }>;
  listSessions: () => Promise<SessionState[]>;
  createSession: (input: CreateSessionInput) => Promise<SessionState>;
  runAgent: (input: RunAgentInput) => Promise<{ runId: string }>;
  resolveApproval: (decision: ApprovalDecision) => Promise<void>;
  onAgentStep: (listener: (event: AgentStepEvent) => void) => () => void;
  onRunCompleted: (listener: (event: AgentRunCompletedEvent) => void) => () => void;
  onApprovalRequest: (listener: (request: ApprovalRequest) => void) => () => void;
}
