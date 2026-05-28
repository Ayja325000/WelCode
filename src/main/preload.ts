import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentRunCompletedEvent,
  AgentStepEvent,
  ApprovalDecision,
  ApprovalRequest,
  CreateSessionInput,
  IpcApi,
  ProviderSettings,
  RunAgentInput,
  SessionState
} from "../shared/types";
import { IPC_CHANNELS } from "./channels";

const api: IpcApi = {
  getDefaultWorkspace: () => ipcRenderer.invoke(IPC_CHANNELS.defaultWorkspace),
  getProviderSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet) as Promise<ProviderSettings>,
  saveProviderSettings: (settings: ProviderSettings) => ipcRenderer.invoke(IPC_CHANNELS.settingsSave, settings),
  openSessionStorageDir: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.sessionOpenStorageDir, sessionId) as Promise<{ ok: boolean; message?: string }>,
  listSessions: () => ipcRenderer.invoke(IPC_CHANNELS.sessionList) as Promise<SessionState[]>,
  createSession: (input: CreateSessionInput) => ipcRenderer.invoke(IPC_CHANNELS.sessionCreate, input),
  runAgent: (input: RunAgentInput) => ipcRenderer.invoke(IPC_CHANNELS.agentRun, input),
  resolveApproval: (decision: ApprovalDecision) => ipcRenderer.invoke(IPC_CHANNELS.approvalResolve, decision),
  onAgentStep: (listener: (event: AgentStepEvent) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, payload: AgentStepEvent) => listener(payload);
    ipcRenderer.on(IPC_CHANNELS.eventStep, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.eventStep, wrapped);
    };
  },
  onRunCompleted: (listener: (event: AgentRunCompletedEvent) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, payload: AgentRunCompletedEvent) => listener(payload);
    ipcRenderer.on(IPC_CHANNELS.eventRunCompleted, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.eventRunCompleted, wrapped);
    };
  },
  onApprovalRequest: (listener: (request: ApprovalRequest) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, payload: ApprovalRequest) => listener(payload);
    ipcRenderer.on(IPC_CHANNELS.eventApprovalRequest, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.eventApprovalRequest, wrapped);
    };
  }
};

contextBridge.exposeInMainWorld("agentApi", api);
