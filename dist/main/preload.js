"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const channels_1 = require("./channels");
const api = {
    getDefaultWorkspace: () => electron_1.ipcRenderer.invoke(channels_1.IPC_CHANNELS.defaultWorkspace),
    getProviderSettings: () => electron_1.ipcRenderer.invoke(channels_1.IPC_CHANNELS.settingsGet),
    saveProviderSettings: (settings) => electron_1.ipcRenderer.invoke(channels_1.IPC_CHANNELS.settingsSave, settings),
    openSessionStorageDir: (sessionId) => electron_1.ipcRenderer.invoke(channels_1.IPC_CHANNELS.sessionOpenStorageDir, sessionId),
    listSessions: () => electron_1.ipcRenderer.invoke(channels_1.IPC_CHANNELS.sessionList),
    createSession: (input) => electron_1.ipcRenderer.invoke(channels_1.IPC_CHANNELS.sessionCreate, input),
    runAgent: (input) => electron_1.ipcRenderer.invoke(channels_1.IPC_CHANNELS.agentRun, input),
    resolveApproval: (decision) => electron_1.ipcRenderer.invoke(channels_1.IPC_CHANNELS.approvalResolve, decision),
    onAgentStep: (listener) => {
        const wrapped = (_, payload) => listener(payload);
        electron_1.ipcRenderer.on(channels_1.IPC_CHANNELS.eventStep, wrapped);
        return () => {
            electron_1.ipcRenderer.removeListener(channels_1.IPC_CHANNELS.eventStep, wrapped);
        };
    },
    onRunCompleted: (listener) => {
        const wrapped = (_, payload) => listener(payload);
        electron_1.ipcRenderer.on(channels_1.IPC_CHANNELS.eventRunCompleted, wrapped);
        return () => {
            electron_1.ipcRenderer.removeListener(channels_1.IPC_CHANNELS.eventRunCompleted, wrapped);
        };
    },
    onApprovalRequest: (listener) => {
        const wrapped = (_, payload) => listener(payload);
        electron_1.ipcRenderer.on(channels_1.IPC_CHANNELS.eventApprovalRequest, wrapped);
        return () => {
            electron_1.ipcRenderer.removeListener(channels_1.IPC_CHANNELS.eventApprovalRequest, wrapped);
        };
    }
};
electron_1.contextBridge.exposeInMainWorld("agentApi", api);
