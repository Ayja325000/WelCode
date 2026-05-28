# WelCode Agent MVP

Codex-style desktop `CodeAgent` built with Electron + React + TypeScript.

## Features

- Desktop shell with session list, task input, execution timeline, and summary panel.
- Agent core pipeline:
  - understand task
  - generate plan
  - execute tools
  - output patch suggestion
  - summarize run
- MCP-style tool gateway with built-in `shell`, `fs`, `git`.
- Safety guardrails:
  - command risk detection
  - approval flow for risky commands
  - workspace path confinement
- Local persistence:
  - session history
  - workspace-scoped memory
  - structured audit logs in `.welcode/audit.log`
- Provider abstraction:
  - OpenAI provider when `OPENAI_API_KEY` is set
  - deterministic heuristic fallback
- In-app settings:
  - custom API base URL
  - custom API key
- Fixed model selector in main panel (Codex-style presets).

## Quick Start

```bash
npm install
npm run dev
```

Production build and run:

```bash
npm run build
npm start
```

## Environment

- Optional: `OPENAI_API_KEY` to enable OpenAI planning/summarization provider.
- Without the key, the app runs with a heuristic provider.
- You can also set provider configuration in the app Settings dialog (saved to `.welcode/settings.json`).

## Tests

```bash
npm run typecheck
npm test
npm run test:e2e
```

Notes:
- E2E is Playwright + Electron smoke coverage.
- In offline/sandboxed environments, Electron binary download may be unavailable and the E2E test is skipped.

## Structure

- `src/main`: Electron main + preload + IPC wiring
- `src/renderer`: React desktop UI
- `src/core`: agent orchestration, tools, risk checks, persistence
- `src/shared`: cross-process types/contracts
- `tests`: unit/integration/e2e coverage
