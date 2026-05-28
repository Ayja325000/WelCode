"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const EMPTY_FILE = { sessions: [] };
class SessionStore {
    storageDir;
    storageFile;
    memoryDir;
    sessionsDir;
    constructor(basePath) {
        this.storageDir = node_path_1.default.join(basePath, ".welcode");
        this.storageFile = node_path_1.default.join(this.storageDir, "sessions.json");
        this.memoryDir = node_path_1.default.join(this.storageDir, "workspace-memory");
        this.sessionsDir = node_path_1.default.join(this.storageDir, "sessions");
        this.ensureFiles();
        this.migrateLegacySessions();
    }
    listSessions() {
        return this.read().sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    createSession(workspacePath) {
        const now = new Date().toISOString();
        const session = {
            sessionId: (0, node_crypto_1.randomUUID)(),
            workspacePath,
            createdAt: now,
            updatedAt: now,
            messages: [],
            workspaceMemory: this.readWorkspaceMemory(workspacePath),
            artifacts: []
        };
        const file = this.read();
        file.sessions.push(session);
        this.write(file);
        this.ensureSessionDir(session.sessionId);
        return session;
    }
    getSession(sessionId) {
        return this.read().sessions.find((session) => session.sessionId === sessionId);
    }
    appendMessage(sessionId, message) {
        const file = this.read();
        const session = file.sessions.find((entry) => entry.sessionId === sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} was not found.`);
        }
        session.messages.push({
            id: (0, node_crypto_1.randomUUID)(),
            content: message.content,
            role: message.role,
            createdAt: new Date().toISOString()
        });
        session.updatedAt = new Date().toISOString();
        this.write(file);
        this.writeSessionSnapshot(session);
        return session;
    }
    updateWorkspaceMemory(sessionId, memoryUpdates) {
        const file = this.read();
        const session = file.sessions.find((entry) => entry.sessionId === sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} was not found.`);
        }
        session.workspaceMemory = { ...session.workspaceMemory, ...memoryUpdates };
        session.updatedAt = new Date().toISOString();
        this.write(file);
        this.writeWorkspaceMemory(session.workspacePath, session.workspaceMemory);
        this.writeSessionSnapshot(session);
        return session;
    }
    addArtifact(sessionId, artifact) {
        const file = this.read();
        const session = file.sessions.find((entry) => entry.sessionId === sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} was not found.`);
        }
        session.artifacts.push(artifact);
        session.updatedAt = new Date().toISOString();
        this.write(file);
        this.writeSessionSnapshot(session);
        return session;
    }
    getSessionDirPath(sessionId) {
        const dir = node_path_1.default.join(this.sessionsDir, sessionId);
        if (!(0, node_fs_1.existsSync)(dir)) {
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        }
        return dir;
    }
    ensureFiles() {
        if (!(0, node_fs_1.existsSync)(this.storageDir)) {
            (0, node_fs_1.mkdirSync)(this.storageDir, { recursive: true });
        }
        if (!(0, node_fs_1.existsSync)(this.memoryDir)) {
            (0, node_fs_1.mkdirSync)(this.memoryDir, { recursive: true });
        }
        if (!(0, node_fs_1.existsSync)(this.sessionsDir)) {
            (0, node_fs_1.mkdirSync)(this.sessionsDir, { recursive: true });
        }
        if (!(0, node_fs_1.existsSync)(this.storageFile)) {
            (0, node_fs_1.writeFileSync)(this.storageFile, JSON.stringify(EMPTY_FILE, null, 2), "utf-8");
        }
    }
    read() {
        return JSON.parse((0, node_fs_1.readFileSync)(this.storageFile, "utf-8"));
    }
    write(file) {
        (0, node_fs_1.writeFileSync)(this.storageFile, JSON.stringify(file, null, 2), "utf-8");
    }
    migrateLegacySessions() {
        const file = this.read();
        for (const session of file.sessions) {
            this.ensureSessionDir(session.sessionId);
            this.writeSessionSnapshot(session);
        }
    }
    ensureSessionDir(sessionId) {
        const dir = node_path_1.default.join(this.sessionsDir, sessionId);
        if (!(0, node_fs_1.existsSync)(dir)) {
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        }
    }
    writeSessionSnapshot(session) {
        const dir = this.getSessionDirPath(session.sessionId);
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(dir, "session.json"), JSON.stringify(session, null, 2), "utf-8");
    }
    readWorkspaceMemory(workspacePath) {
        const memoryFile = this.workspaceMemoryPath(workspacePath);
        if (!(0, node_fs_1.existsSync)(memoryFile)) {
            return {};
        }
        return JSON.parse((0, node_fs_1.readFileSync)(memoryFile, "utf-8"));
    }
    writeWorkspaceMemory(workspacePath, memory) {
        const memoryFile = this.workspaceMemoryPath(workspacePath);
        (0, node_fs_1.writeFileSync)(memoryFile, JSON.stringify(memory, null, 2), "utf-8");
    }
    workspaceMemoryPath(workspacePath) {
        const safeName = workspacePath.replace(/[:\\/]+/g, "_");
        return node_path_1.default.join(this.memoryDir, `${safeName}.json`);
    }
}
exports.SessionStore = SessionStore;
