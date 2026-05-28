import path from "node:path";
import { randomUUID } from "node:crypto";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import type { ApprovalDecision, ApprovalRequest, ProviderSettings, RunAgentInput } from "../shared/types";
import type { AgentService } from "../core/agent-service";
import { createProviderFromSettings } from "../core/provider";
import { ToolGateway } from "../core/tools/tool-gateway";
import { SessionStore } from "../core/persistence/session-store";
import { SettingsStore } from "../core/persistence/settings-store";
import { IPC_CHANNELS } from "./channels";
import { AgentService as AgentServiceImpl } from "../core/agent-service";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

let mainWindow: BrowserWindow | null = null;
let agentService: AgentService;
let settingsStore: SettingsStore;
let sessionStore: SessionStore;
const pendingApprovals = new Map<string, (approved: boolean) => void>();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "WelCode Agent",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "../renderer/index.html");
    void mainWindow.loadFile(indexPath);
  }
}

function setupIpc(service: AgentService): void {
  ipcMain.handle(IPC_CHANNELS.defaultWorkspace, async () => process.cwd());
  ipcMain.handle(IPC_CHANNELS.settingsGet, async () => settingsStore.getSettings());
  ipcMain.handle(IPC_CHANNELS.settingsSave, async (_, input: ProviderSettings) => settingsStore.saveSettings(input));
  ipcMain.handle(IPC_CHANNELS.sessionOpenStorageDir, async (_, sessionId: string) => {
    if (!sessionId?.trim()) {
      return { ok: false, message: "Session ID is required." };
    }
    const session = sessionStore.getSession(sessionId);
    if (!session) {
      return { ok: false, message: "Session not found." };
    }
    const dir = sessionStore.getSessionDirPath(sessionId);
    const error = await shell.openPath(dir);
    if (!error) {
      return { ok: true };
    }

    // Fallback on Windows/macOS when openPath fails in some environments.
    try {
      shell.showItemInFolder(path.join(dir, "session.json"));
      return { ok: true, message: "Opened via fallback." };
    } catch (fallbackError) {
      return { ok: false, message: `${error}; fallback failed: ${(fallbackError as Error).message}` };
    }
  });

  ipcMain.handle(IPC_CHANNELS.sessionList, async () => service.listSessions());

  ipcMain.handle(IPC_CHANNELS.sessionCreate, async (_, input: { workspacePath: string }) =>
    service.createSession(input.workspacePath)
  );

  ipcMain.handle(IPC_CHANNELS.agentRun, async (_, input: RunAgentInput) => {
    const runId = randomUUID();
    if (!input?.sessionId || !input?.request?.task?.trim()) {
      throw new Error("Invalid run request: session and task are required.");
    }
    void runAgent(service, input, runId);
    return { runId };
  });

  ipcMain.handle(IPC_CHANNELS.approvalResolve, async (_, decision: ApprovalDecision) => {
    const key = approvalKey(decision.runId, decision.approvalId);
    const resolver = pendingApprovals.get(key);
    if (resolver) {
      resolver(decision.approved);
      pendingApprovals.delete(key);
    }
  });
}

async function runAgent(service: AgentService, input: RunAgentInput, runId: string): Promise<void> {
  try {
    mainWindow?.webContents.send(IPC_CHANNELS.eventStep, {
      runId,
      step: {
        id: randomUUID(),
        type: "think",
        status: "in_progress",
        timestamp: new Date().toISOString(),
        payload: { message: "Run accepted by main process. Starting agent..." }
      }
    });

    const result = await service.run(
      input.sessionId,
      input.request,
      {
        onStep: (step) => {
          mainWindow?.webContents.send(IPC_CHANNELS.eventStep, { runId, step });
        },
        requestApproval: (request) => handleApprovalRequest(request)
      },
      runId
    );

    mainWindow?.webContents.send(IPC_CHANNELS.eventRunCompleted, {
      runId,
      result
    });
  } catch (error) {
    mainWindow?.webContents.send(IPC_CHANNELS.eventRunCompleted, {
      runId,
      result: {
        runId,
        summary: `Run failed: ${(error as Error).message}`,
        success: false,
        steps: []
      }
    });
  }
}

function handleApprovalRequest(request: ApprovalRequest): Promise<boolean> {
  return new Promise((resolve) => {
    const key = approvalKey(request.runId, request.approvalId);
    pendingApprovals.set(key, resolve);
    mainWindow?.webContents.send(IPC_CHANNELS.eventApprovalRequest, request);
  });
}

function approvalKey(runId: string, approvalId: string): string {
  return `${runId}:${approvalId}`;
}

app.whenReady().then(() => {
  sessionStore = new SessionStore(process.cwd());
  settingsStore = new SettingsStore(process.cwd());
  const gateway = new ToolGateway();
  agentService = new AgentServiceImpl(
    () => createProviderFromSettings(settingsStore.getSettings()),
    gateway,
    sessionStore
  );
  setupIpc(agentService);
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
