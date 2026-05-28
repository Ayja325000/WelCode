import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SessionMessage, SessionState } from "../../shared/types";

interface SessionFile {
  sessions: SessionState[];
}

const EMPTY_FILE: SessionFile = { sessions: [] };

export class SessionStore {
  private readonly storageDir: string;
  private readonly storageFile: string;
  private readonly memoryDir: string;
  private readonly sessionsDir: string;

  constructor(basePath: string) {
    this.storageDir = path.join(basePath, ".welcode");
    this.storageFile = path.join(this.storageDir, "sessions.json");
    this.memoryDir = path.join(this.storageDir, "workspace-memory");
    this.sessionsDir = path.join(this.storageDir, "sessions");
    this.ensureFiles();
    this.migrateLegacySessions();
  }

  listSessions(): SessionState[] {
    return this.read().sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  createSession(workspacePath: string): SessionState {
    const now = new Date().toISOString();
    const session: SessionState = {
      sessionId: randomUUID(),
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

  getSession(sessionId: string): SessionState | undefined {
    return this.read().sessions.find((session) => session.sessionId === sessionId);
  }

  appendMessage(sessionId: string, message: Omit<SessionMessage, "id" | "createdAt">): SessionState {
    const file = this.read();
    const session = file.sessions.find((entry) => entry.sessionId === sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} was not found.`);
    }

    session.messages.push({
      id: randomUUID(),
      content: message.content,
      role: message.role,
      createdAt: new Date().toISOString()
    });
    session.updatedAt = new Date().toISOString();
    this.write(file);
    this.writeSessionSnapshot(session);
    return session;
  }

  updateWorkspaceMemory(sessionId: string, memoryUpdates: Record<string, string>): SessionState {
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

  addArtifact(sessionId: string, artifact: string): SessionState {
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

  getSessionDirPath(sessionId: string): string {
    const dir = path.join(this.sessionsDir, sessionId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private ensureFiles(): void {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
    if (!existsSync(this.memoryDir)) {
      mkdirSync(this.memoryDir, { recursive: true });
    }
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
    if (!existsSync(this.storageFile)) {
      writeFileSync(this.storageFile, JSON.stringify(EMPTY_FILE, null, 2), "utf-8");
    }
  }

  private read(): SessionFile {
    return JSON.parse(readFileSync(this.storageFile, "utf-8")) as SessionFile;
  }

  private write(file: SessionFile): void {
    writeFileSync(this.storageFile, JSON.stringify(file, null, 2), "utf-8");
  }

  private migrateLegacySessions(): void {
    const file = this.read();
    for (const session of file.sessions) {
      this.ensureSessionDir(session.sessionId);
      this.writeSessionSnapshot(session);
    }
  }

  private ensureSessionDir(sessionId: string): void {
    const dir = path.join(this.sessionsDir, sessionId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private writeSessionSnapshot(session: SessionState): void {
    const dir = this.getSessionDirPath(session.sessionId);
    writeFileSync(path.join(dir, "session.json"), JSON.stringify(session, null, 2), "utf-8");
  }

  private readWorkspaceMemory(workspacePath: string): Record<string, string> {
    const memoryFile = this.workspaceMemoryPath(workspacePath);
    if (!existsSync(memoryFile)) {
      return {};
    }
    return JSON.parse(readFileSync(memoryFile, "utf-8")) as Record<string, string>;
  }

  private writeWorkspaceMemory(workspacePath: string, memory: Record<string, string>): void {
    const memoryFile = this.workspaceMemoryPath(workspacePath);
    writeFileSync(memoryFile, JSON.stringify(memory, null, 2), "utf-8");
  }

  private workspaceMemoryPath(workspacePath: string): string {
    const safeName = workspacePath.replace(/[:\\/]+/g, "_");
    return path.join(this.memoryDir, `${safeName}.json`);
  }
}
