"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogger = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
class AuditLogger {
    workspacePath;
    logFilePath;
    constructor(workspacePath) {
        this.workspacePath = workspacePath;
        const dir = node_path_1.default.join(workspacePath, ".welcode");
        if (!(0, node_fs_1.existsSync)(dir)) {
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        }
        this.logFilePath = node_path_1.default.join(dir, "audit.log");
    }
    write(event) {
        (0, node_fs_1.appendFileSync)(this.logFilePath, `${JSON.stringify(event)}\n`, "utf-8");
    }
}
exports.AuditLogger = AuditLogger;
