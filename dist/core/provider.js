"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = exports.HeuristicProvider = void 0;
exports.createProvider = createProvider;
exports.createProviderFromSettings = createProviderFromSettings;
class HeuristicProvider {
    async planTask(request) {
        const commands = ["git status --short --branch"];
        const normalizedTask = request.task.toLowerCase();
        if (normalizedTask.includes("test")) {
            commands.push("npm test");
        }
        if (normalizedTask.includes("build")) {
            commands.push("npm run build");
        }
        if (normalizedTask.includes("file") || normalizedTask.includes("code")) {
            commands.push("rg --files");
        }
        return {
            thought: "Generate a safe execution plan, inspect workspace state, then run requested validation commands.",
            commands,
            patchSuggestion: "Apply minimal edits based on command output. Keep changes focused, verify with tests, then summarize the impact."
        };
    }
    async summarize(request, toolOutputs) {
        const compactOutput = toolOutputs.filter(Boolean).join("\n\n").slice(0, 1500);
        return [
            `Task: ${request.task}`,
            "Execution completed with heuristic provider.",
            "Key output:",
            compactOutput || "No command output captured.",
            "Next step: review proposed edits and rerun checks if needed."
        ].join("\n");
    }
}
exports.HeuristicProvider = HeuristicProvider;
class OpenAIProvider {
    apiKey;
    baseUrl;
    constructor(apiKey, baseUrl = "https://api.openai.com/v1") {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    async planTask(request) {
        const model = request.model || "gpt-4.1-mini";
        const prompt = [
            "You are a coding assistant planner.",
            "Return strict JSON with keys: thought (string), commands (string[]), patchSuggestion (string).",
            "Focus on safe, workspace-local commands only.",
            `Task: ${request.task}`,
            `Constraints: ${(request.constraints ?? []).join(", ") || "none"}`
        ].join("\n");
        const raw = await this.callResponsesApi(prompt, model);
        try {
            const parsed = JSON.parse(raw);
            return {
                thought: parsed.thought,
                commands: parsed.commands.slice(0, 5),
                patchSuggestion: parsed.patchSuggestion
            };
        }
        catch {
            return new HeuristicProvider().planTask(request);
        }
    }
    async summarize(request, toolOutputs) {
        const model = request.model || "gpt-4.1-mini";
        const prompt = [
            "Summarize this coding-agent run for a developer in concise bullet points.",
            `Task: ${request.task}`,
            "Outputs:",
            toolOutputs.slice(0, 5).join("\n\n")
        ].join("\n");
        return this.callResponsesApi(prompt, model);
    }
    async callResponsesApi(prompt, model) {
        const normalizedBase = normalizeApiBase(this.baseUrl);
        const responsesPayload = {
            model,
            input: prompt
        };
        const responsesUrl = `${normalizedBase}/responses`;
        const responsesResponse = await fetch(responsesUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(responsesPayload)
        });
        if (responsesResponse.ok) {
            const maybeText = await parseResponsesText(responsesResponse);
            if (maybeText) {
                return maybeText;
            }
        }
        // OpenAI-compatible fallback for gateways that only implement chat completions.
        const chatUrl = `${normalizedBase}/chat/completions`;
        const chatResponse = await fetch(chatUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2
            })
        });
        if (!chatResponse.ok) {
            throw new Error(`API request failed: responses=${responsesResponse.status}, chat=${chatResponse.status}`);
        }
        const chatText = await parseChatCompletionsText(chatResponse);
        if (!chatText) {
            throw new Error("API returned empty completion text.");
        }
        return chatText;
    }
}
exports.OpenAIProvider = OpenAIProvider;
function normalizeApiBase(baseUrl) {
    const base = baseUrl.trim().replace(/\/+$/, "");
    if (!base) {
        return "https://api.openai.com/v1";
    }
    if (base.endsWith("/v1")) {
        return base;
    }
    return `${base}/v1`;
}
async function parseResponsesText(response) {
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
        return "";
    }
    const data = (await response.json());
    if (typeof data.output_text === "string" && data.output_text.trim()) {
        return data.output_text.trim();
    }
    const fallbackText = data.output
        ?.flatMap((entry) => entry.content ?? [])
        .map((part) => part.text ?? "")
        .join("")
        .trim();
    return fallbackText || "";
}
async function parseChatCompletionsText(response) {
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
        const preview = (await response.text()).slice(0, 120).replace(/\s+/g, " ");
        throw new Error("API response is not JSON. Check API Base URL (should point to provider API host, not a web page). " +
            `Preview: ${preview}`);
    }
    const data = (await response.json());
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || "";
}
function createProvider() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
        return new OpenAIProvider(apiKey, process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1");
    }
    return new HeuristicProvider();
}
function createProviderFromSettings(settings) {
    if (settings.apiKey) {
        return new OpenAIProvider(settings.apiKey, settings.apiBaseUrl);
    }
    return createProvider();
}
