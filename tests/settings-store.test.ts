import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsStore } from "../src/core/persistence/settings-store";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SettingsStore", () => {
  it("loads defaults and persists user settings", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "welcode-settings-"));
    tempDirs.push(root);
    const store = new SettingsStore(root);

    const defaults = store.getSettings();
    expect(defaults.apiBaseUrl).toBe("https://api.openai.com/v1");
    expect(defaults.model).toBe("gpt-4.1-mini");

    store.saveSettings({
      apiBaseUrl: "https://example-proxy/v1",
      apiKey: "key-123",
      model: "gpt-4.1"
    });

    const saved = store.getSettings();
    expect(saved.apiBaseUrl).toBe("https://example-proxy/v1");
    expect(saved.apiKey).toBe("key-123");
    expect(saved.model).toBe("gpt-4.1");
  });
});
