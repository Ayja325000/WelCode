import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ProviderSettings } from "../../shared/types";

const DEFAULT_SETTINGS: ProviderSettings = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini"
};

export class SettingsStore {
  private readonly storageDir: string;
  private readonly storageFile: string;

  constructor(basePath: string) {
    this.storageDir = path.join(basePath, ".welcode");
    this.storageFile = path.join(this.storageDir, "settings.json");
    this.ensureFiles();
  }

  getSettings(): ProviderSettings {
    const loaded = JSON.parse(readFileSync(this.storageFile, "utf-8")) as Partial<ProviderSettings>;
    return {
      apiBaseUrl: loaded.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl,
      apiKey: loaded.apiKey ?? DEFAULT_SETTINGS.apiKey,
      model: loaded.model ?? DEFAULT_SETTINGS.model
    };
  }

  saveSettings(settings: ProviderSettings): ProviderSettings {
    const normalized: ProviderSettings = {
      apiBaseUrl: settings.apiBaseUrl.trim() || DEFAULT_SETTINGS.apiBaseUrl,
      apiKey: settings.apiKey.trim(),
      model: (settings.model ?? "").trim() || DEFAULT_SETTINGS.model
    };
    writeFileSync(this.storageFile, JSON.stringify(normalized, null, 2), "utf-8");
    return normalized;
  }

  private ensureFiles(): void {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
    if (!existsSync(this.storageFile)) {
      writeFileSync(this.storageFile, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
    }
  }
}
