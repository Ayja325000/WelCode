"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const electron_1 = require("electron");
const provider_1 = require("../core/provider");
const tool_gateway_1 = require("../core/tools/tool-gateway");
const session_store_1 = require("../core/persistence/session-store");
const settings_store_1 = require("../core/persistence/settings-store");
const channels_1 = require("./channels");
const agent_service_1 = require("../core/agent-service");
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let mainWindow = null;
let agentService;
let settingsStore;
let sessionStore;
const pendingApprovals = new Map();
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        title: "WelCode Agent",
        webPreferences: {
            preload: node_path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    else {
        const indexPath = node_path_1.default.join(__dirname, "../renderer/index.html");
        void mainWindow.loadFile(indexPath);
    }
}
function setupIpc(service) {
    electron_1.ipcMain.handle(channels_1.IPC_CHANNELS.defaultWorkspace, async () => process.cwd());
    electron_1.ipcMain.handle(channels_1.IPC_CHANNELS.settingsGet, async () => settingsStore.getSettings());
    electron_1.ipcMain.handle(channels_1.IPC_CHANNELS.settingsSave, async (_, input) => settingsStore.saveSettings(input));
    electron_1.ipcMain.handle(channels_1.IPC_CHANNELS.sessionOpenStorageDir, async (_, sessionId) => {
        if (!sessionId?.trim()) {
            return { ok: false, message: "Session ID is required." };
        }
        const session = sessionStore.getSession(sessionId);
        if (!session) {
            return { ok: false, message: "Session not found." };
        }
        const dir = sessionStore.getSessionDirPath(sessionId);
        const error = await electron_1.shell.openPath(dir);
        if (!error) {
            return { ok: true };
        }
        // Fallback on Windows/macOS when openPath fails in some environments.
        try {
            electron_1.shell.showItemInFolder(node_path_1.default.join(dir, "session.json"));
            return { ok: true, message: "Opened via fallback." };
        }
        catch (fallbackError) {
            return { ok: false, message: `${error}; fallback failed: ${fallbackError.message}` };
        }
    });
    electron_1.ipcMain.handle(channels_1.IPC_CHANNELS.sessionList, async () => service.listSessions());
    electron_1.ipcMain.handle(channels_1.IPC_CHANNELS.sessionCreate, async (_, input) => service.createSession(input.workspacePath));
    electron_1.ipcMain.handle(channels_1.IPC_CHANNELS.agentRun, async (_, input) => {
        const runId = (0, node_crypto_1.randomUUID)();
        if (!input?.sessionId || !input?.request?.task?.trim()) {
            throw new Error("Invalid run request: session and task are required.");
        }
        void runAgent(service, input, runId);
        return { runId };
    });
    electron_1.ipcMain.handle(channels_1.IPC_CHANNELS.approvalResolve, async (_, decision) => {
        const key = approvalKey(decision.runId, decision.approvalId);
        const resolver = pendingApprovals.get(key);
        if (resolver) {
            resolver(decision.approved);
            pendingApprovals.delete(key);
        }
    });
}
async function runAgent(service, input, runId) {
    try {
        mainWindow?.webContents.send(channels_1.IPC_CHANNELS.eventStep, {
            runId,
            step: {
                id: (0, node_crypto_1.randomUUID)(),
                type: "think",
                status: "in_progress",
                timestamp: new Date().toISOString(),
                payload: { message: "Run accepted by main process. Starting agent..." }
            }
        });
        const result = await service.run(input.sessionId, input.request, {
            onStep: (step) => {
                mainWindow?.webContents.send(channels_1.IPC_CHANNELS.eventStep, { runId, step });
            },
            requestApproval: (request) => handleApprovalRequest(request)
        }, runId);
        mainWindow?.webContents.send(channels_1.IPC_CHANNELS.eventRunCompleted, {
            runId,
            result
        });
    }
    catch (error) {
        mainWindow?.webContents.send(channels_1.IPC_CHANNELS.eventRunCompleted, {
            runId,
            result: {
                runId,
                summary: `Run failed: ${error.message}`,
                success: false,
                steps: []
            }
        });
    }
}
function handleApprovalRequest(request) {
    return new Promise((resolve) => {
        const key = approvalKey(request.runId, request.approvalId);
        pendingApprovals.set(key, resolve);
        mainWindow?.webContents.send(channels_1.IPC_CHANNELS.eventApprovalRequest, request);
    });
}
function approvalKey(runId, approvalId) {
    return `${runId}:${approvalId}`;
}
electron_1.app.whenReady().then(() => {
    sessionStore = new session_store_1.SessionStore(process.cwd());
    settingsStore = new settings_store_1.SettingsStore(process.cwd());
    const gateway = new tool_gateway_1.ToolGateway();
    agentService = new agent_service_1.AgentService(() => (0, provider_1.createProviderFromSettings)(settingsStore.getSettings()), gateway, sessionStore);
    setupIpc(agentService);
    createWindow();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
