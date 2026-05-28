import { useEffect, useMemo, useState } from "react";
import type {
  AgentRunCompletedEvent,
  AgentStep,
  ApprovalRequest,
  ProviderSettings,
  SessionState
} from "../shared/types";

const FIXED_MODELS = [
  "gpt-5.3-codex",
  "gpt-5.4",
] as const;

export function App() {
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [workspacePath, setWorkspacePath] = useState("");
  const [task, setTask] = useState("");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runSummary, setRunSummary] = useState("");
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
  const [activeRunId, setActiveRunId] = useState("");
  const [bootError, setBootError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    sessionId: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(FIXED_MODELS[0]);
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>({
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: FIXED_MODELS[0]
  });

  const api = window.agentApi;

  const selectedSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId),
    [sessions, selectedSessionId]
  );

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      if (!api) {
        if (mounted) {
          setBootError("agentApi bridge is not available. Check Electron preload initialization.");
        }
        return;
      }

      try {
        const [defaultWorkspace, existingSessions, loadedSettings] = await Promise.all([
          api.getDefaultWorkspace(),
          api.listSessions(),
          api.getProviderSettings()
        ]);

        if (!mounted) {
          return;
        }

        setWorkspacePath(defaultWorkspace);
        setProviderSettings(loadedSettings);
        const preferredModel =
          loadedSettings.model && FIXED_MODELS.includes(loadedSettings.model as (typeof FIXED_MODELS)[number])
            ? loadedSettings.model
            : FIXED_MODELS[0];
        setSelectedModel(preferredModel);
        setSessions(existingSessions);
        if (existingSessions[0]) {
          setSelectedSessionId(existingSessions[0].sessionId);
        }
      } catch (error) {
        if (mounted) {
          setBootError((error as Error).message);
        }
      }
    };

    void boot();

    if (!api) {
      return () => {
        mounted = false;
      };
    }

    const offStep = api.onAgentStep((event) => {
      if (event.runId !== activeRunId && activeRunId) {
        return;
      }
      setSteps((prev) => [...prev, event.step]);
    });

    const offCompleted = api.onRunCompleted((event: AgentRunCompletedEvent) => {
      if (event.runId !== activeRunId && activeRunId) {
        return;
      }
      setIsRunning(false);
      setRunSummary(event.result.summary);
      void refreshSessions();
    });

    const offApproval = api.onApprovalRequest((request) => {
      setPendingApproval(request);
    });

    return () => {
      mounted = false;
      offStep();
      offCompleted();
      offApproval();
    };
  }, [activeRunId, api]);

  useEffect(() => {
    const dismiss = () => setContextMenu(null);
    window.addEventListener("click", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("click", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, []);

  async function refreshSessions(): Promise<void> {
    if (!api) {
      return;
    }
    const existingSessions = await api.listSessions();
    setSessions(existingSessions);
    if (!selectedSessionId && existingSessions[0]) {
      setSelectedSessionId(existingSessions[0].sessionId);
    }
  }

  async function createSession(): Promise<void> {
    if (!workspacePath.trim() || !api) {
      return;
    }
    const session = await api.createSession({ workspacePath: workspacePath.trim() });
    setSessions((prev) => [session, ...prev]);
    setSelectedSessionId(session.sessionId);
    setSteps([]);
    setRunSummary("");
  }

  async function runTask(): Promise<void> {
    if (!api) {
      setRunSummary("Run failed: agentApi bridge is unavailable.");
      return;
    }
    if (!workspacePath.trim()) {
      setRunSummary("Run blocked: workspace path is empty.");
      return;
    }
    if (!task.trim()) {
      setRunSummary("Run blocked: please enter a task description.");
      return;
    }

    let runSessionId = selectedSessionId;
    if (!runSessionId) {
      try {
        const session = await api.createSession({ workspacePath: workspacePath.trim() });
        setSessions((prev) => [session, ...prev]);
        setSelectedSessionId(session.sessionId);
        runSessionId = session.sessionId;
      } catch (error) {
        setRunSummary(`Run failed: cannot create session: ${(error as Error).message}`);
        return;
      }
    }

    setIsRunning(true);
    setRunSummary("Run started...");
    setSteps([]);

    try {
      const { runId } = await api.runAgent({
        sessionId: runSessionId,
        request: {
          task: task.trim(),
          workspacePath: workspacePath.trim(),
          approvalMode: "sandbox",
          model: selectedModel
        }
      });
      setActiveRunId(runId);
    } catch (error) {
      setIsRunning(false);
      setRunSummary(`Run failed: ${(error as Error).message}`);
    }
  }

  async function resolveApproval(approved: boolean): Promise<void> {
    if (!pendingApproval || !api) {
      return;
    }

    await api.resolveApproval({
      runId: pendingApproval.runId,
      approvalId: pendingApproval.approvalId,
      approved
    });
    setPendingApproval(null);
  }

  async function saveSettings(): Promise<void> {
    if (!api) {
      return;
    }

    setSettingsSaving(true);
    setSettingsMessage("");

    try {
      const saved = await api.saveProviderSettings({
        ...providerSettings,
        model: selectedModel || providerSettings.model || FIXED_MODELS[0]
      });

      setProviderSettings(saved);
      setSelectedModel(saved.model || FIXED_MODELS[0]);
      setSettingsMessage("Settings saved. New runs will use this config.");
    } catch (error) {
      setSettingsMessage(`Save failed: ${(error as Error).message}`);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function openSessionStorageDir(sessionId: string): Promise<void> {
    if (!api) {
      setRunSummary("Operation failed: agentApi bridge is unavailable.");
      return;
    }
    const result = await api.openSessionStorageDir(sessionId);
    if (!result.ok) {
      setRunSummary(`Open folder failed: ${result.message ?? "unknown error"}`);
    } else if (result.message) {
      setRunSummary(`Open folder info: ${result.message}`);
    }
  }

  return (
    <div className="shell">
      <aside className="panel sessions">
        <h2>Sessions</h2>
        <label>
          Workspace
          <input value={workspacePath} onChange={(event) => setWorkspacePath(event.target.value)} />
        </label>
        <button onClick={() => void createSession()}>New Session</button>
        <div className="session-list">
          {sessions.map((session) => (
            <button
              key={session.sessionId}
              className={session.sessionId === selectedSessionId ? "session-item active" : "session-item"}
              onClick={() => setSelectedSessionId(session.sessionId)}
              onContextMenu={(event) => {
                event.preventDefault();
                setContextMenu({
                  sessionId: session.sessionId,
                  x: event.clientX,
                  y: event.clientY
                });
              }}
            >
              <strong>{session.sessionId.slice(0, 8)}</strong>
              <span>{new Date(session.updatedAt).toLocaleString()}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="panel center">
        <div className="center-header">
          <h1>WelCode Agent</h1>
          <button className="secondary-btn" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
        <p>Understand request -&gt; plan -&gt; run tools -&gt; propose patch -&gt; summarize.</p>
        {bootError && <p className="error-banner">{bootError}</p>}

        <label>
          Model
          <div className="model-row">
            <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
              {FIXED_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </label>

        <textarea
          placeholder="Describe your coding task..."
          value={task}
          onChange={(event) => setTask(event.target.value)}
          rows={8}
        />
        <button disabled={isRunning} onClick={() => void runTask()}>
          {isRunning ? "Running..." : "Run Agent"}
        </button>

        <div className="messages">
          <h3>Session Messages</h3>
          {(selectedSession?.messages ?? []).slice(-8).map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <strong>{message.role}</strong>
              <p>{message.content}</p>
            </div>
          ))}
        </div>

        <div className="summary">
          <h3>Run Summary</h3>
          <pre>{runSummary || "No run completed yet."}</pre>
        </div>
      </main>

      <aside className="panel timeline">
        <h2>Execution Timeline</h2>
        <ol>
          {steps.map((step) => (
            <li key={step.id}>
              <div className="step-header">
                <strong>{step.type}</strong>
                <span className={`status ${step.status}`}>{step.status}</span>
              </div>
              <pre>{JSON.stringify(step.payload, null, 2)}</pre>
            </li>
          ))}
        </ol>
      </aside>

      {pendingApproval && (
        <div className="approval-overlay">
          <div className="approval-card">
            <h3>Approval Required</h3>
            <p>{pendingApproval.riskReason}</p>
            <pre>{pendingApproval.command}</pre>
            <div className="actions">
              <button onClick={() => void resolveApproval(false)}>Reject</button>
              <button onClick={() => void resolveApproval(true)}>Approve</button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="approval-overlay">
          <div className="approval-card">
            <h3>Provider Settings</h3>
            <label>
              API Base URL
              <input
                value={providerSettings.apiBaseUrl}
                onChange={(event) =>
                  setProviderSettings((prev) => ({ ...prev, apiBaseUrl: event.target.value }))
                }
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label>
              API Key
              <input
                type="password"
                value={providerSettings.apiKey}
                onChange={(event) =>
                  setProviderSettings((prev) => ({ ...prev, apiKey: event.target.value }))
                }
                placeholder="sk-..."
              />
            </label>
            {settingsMessage && <p className="status-banner">{settingsMessage}</p>}
            <div className="actions">
              <button className="secondary-btn" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
              <button disabled={settingsSaving} onClick={() => void saveSettings()}>
                {settingsSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              void openSessionStorageDir(contextMenu.sessionId);
              setContextMenu(null);
            }}
          >
            Open Session Storage Folder
          </button>
        </div>
      )}
    </div>
  );
}
