"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchProviderModels = fetchProviderModels;
function normalizeBaseUrl(input) {
    const trimmed = input.trim().replace(/\/+$/, "");
    if (!trimmed) {
        return "";
    }
    // Align with CC Switch behavior: normalize to /v1 once.
    if (trimmed.endsWith("/v1")) {
        return trimmed;
    }
    if (trimmed.endsWith("/v1/models")) {
        return trimmed.slice(0, -"models".length).replace(/\/+$/, "");
    }
    return `${trimmed}/v1`;
}
function extractModels(payload) {
    if (Array.isArray(payload.data)) {
        return payload.data
            .map((item) => item.id?.trim() || item.name?.trim() || "")
            .filter((id) => id.length > 0);
    }
    if (Array.isArray(payload.models)) {
        return payload.models
            .map((item) => {
            if (typeof item === "string") {
                return item.trim();
            }
            return item.id?.trim() || item.name?.trim() || "";
        })
            .filter((id) => id.length > 0);
    }
    return [];
}
function buildStatusError(status) {
    if (status === 401 || status === 403) {
        return "Authentication failed. Please check API Key permissions.";
    }
    if (status === 404) {
        return "Models endpoint not found. Please check API Base URL (should point to provider root, not web page).";
    }
    if (status >= 500) {
        return "Provider service error. Please retry later.";
    }
    return `Failed to load models: HTTP ${status}`;
}
async function fetchProviderModels(apiBaseUrl, apiKey) {
    const normalizedBase = normalizeBaseUrl(apiBaseUrl);
    if (!normalizedBase) {
        return { models: [], error: "API Base URL is required." };
    }
    if (!apiKey.trim()) {
        return { models: [], error: "API Key is required." };
    }
    const endpoint = `${normalizedBase}/models`;
    try {
        const response = await fetch(endpoint, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });
        if (!response.ok) {
            return { models: [], error: buildStatusError(response.status) };
        }
        const contentType = (response.headers.get("content-type") || "").toLowerCase();
        if (!contentType.includes("application/json")) {
            const preview = (await response.text()).slice(0, 120).replace(/\s+/g, " ");
            return {
                models: [],
                error: "Model endpoint returned non-JSON content. Please verify API Base URL points to API root. " +
                    `Preview: ${preview}`
            };
        }
        const payload = (await response.json());
        const models = Array.from(new Set(extractModels(payload))).sort((a, b) => a.localeCompare(b));
        if (models.length === 0) {
            return { models: [], error: "No models returned by this endpoint." };
        }
        return { models };
    }
    catch (error) {
        return { models: [], error: `Failed to fetch models: ${error.message}` };
    }
}
