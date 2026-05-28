import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it, afterEach } from "vitest";
import { SessionStore } from "../src/core/persistence/session-store";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createTempStore(): { store: SessionStore; workspace: string; root: string } {
  const root = mkdtempSync(path.join(os.tmpdir(), "welcode-store-"));
  tempDirs.push(root);
  const workspace = path.join(root, "workspace-a");
  return { store: new SessionStore(root), workspace, root };
}

describe("SessionStore", () => {
  it("creates, persists, and lists sessions", () => {
    const { store, workspace, root } = createTempStore();

    const created = store.createSession(workspace);
    store.appendMessage(created.sessionId, { role: "user", content: "hello" });
    store.updateWorkspaceMemory(created.sessionId, { lastTask: "hello" });

    const sessions = store.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.messages[0]?.content).toBe("hello");
    expect(sessions[0]?.workspaceMemory.lastTask).toBe("hello");

    const reloadedStore = new SessionStore(root);
    const reloadedSessions = reloadedStore.listSessions();
    expect(reloadedSessions).toHaveLength(1);
    expect(reloadedSessions[0]?.messages).toHaveLength(1);
  });

  it("isolates workspace memory by workspace path", () => {
    const { store, root } = createTempStore();
    const workspaceA = path.join(root, "workspace-a");
    const workspaceB = path.join(root, "workspace-b");

    const sessionA = store.createSession(workspaceA);
    const sessionB = store.createSession(workspaceB);

    store.updateWorkspaceMemory(sessionA.sessionId, { key: "value-a" });
    store.updateWorkspaceMemory(sessionB.sessionId, { key: "value-b" });

    const sessionList = store.listSessions();
    const resolvedA = sessionList.find((entry) => entry.sessionId === sessionA.sessionId);
    const resolvedB = sessionList.find((entry) => entry.sessionId === sessionB.sessionId);

    expect(resolvedA?.workspaceMemory.key).toBe("value-a");
    expect(resolvedB?.workspaceMemory.key).toBe("value-b");
  });

  it("creates a dedicated folder per session with snapshot", () => {
    const { store, workspace } = createTempStore();
    const session = store.createSession(workspace);
    store.appendMessage(session.sessionId, { role: "user", content: "snapshot-test" });

    const sessionDir = store.getSessionDirPath(session.sessionId);
    const snapshotPath = path.join(sessionDir, "session.json");
    expect(existsSync(snapshotPath)).toBe(true);

    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf-8")) as { sessionId: string };
    expect(snapshot.sessionId).toBe(session.sessionId);
  });
});
