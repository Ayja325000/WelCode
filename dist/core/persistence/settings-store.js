"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const DEFAULT_SETTINGS = {
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1-mini"
};
class SettingsStore {
    storageDir;
    storageFile;
    constructor(basePath) {
        this.storageDir = node_path_1.default.join(basePath, ".welcode");
        this.storageFile = node_path_1.default.join(this.storageDir, "settings.json");
        this.ensureFiles();
    }
    getSettings() {
        const loaded = JSON.parse((0, node_fs_1.readFileSync)(this.storageFile, "utf-8"));
        return {
            apiBaseUrl: loaded.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl,
            apiKey: loaded.apiKey ?? DEFAULT_SETTINGS.apiKey,
            model: loaded.model ?? DEFAULT_SETTINGS.model
        };
    }
    saveSettings(settings) {
        const normalized = {
            apiBaseUrl: settings.apiBaseUrl.trim() || DEFAULT_SETTINGS.apiBaseUrl,
            apiKey: settings.apiKey.trim(),
            model: (settings.model ?? "").trim() || DEFAULT_SETTINGS.model
        };
        (0, node_fs_1.writeFileSync)(this.storageFile, JSON.stringify(normalized, null, 2), "utf-8");
        return normalized;
    }
    ensureFiles() {
        if (!(0, node_fs_1.existsSync)(this.storageDir)) {
            (0, node_fs_1.mkdirSync)(this.storageDir, { recursive: true });
        }
        if (!(0, node_fs_1.existsSync)(this.storageFile)) {
            (0, node_fs_1.writeFileSync)(this.storageFile, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
        }
    }
}
exports.SettingsStore = SettingsStore;
