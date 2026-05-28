import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { OpenAIProvider } from "../src/core/provider";

const originalFetch = global.fetch;

describe("OpenAIProvider fallback behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("falls back to chat/completions when responses endpoint is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "ok-from-chat" } }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenAIProvider("k", "https://gmncode.com");
    const text = await (provider as any).callResponsesApi("hello", "gpt-5-codex");

    expect(text).toBe("ok-from-chat");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://gmncode.com/v1/responses",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://gmncode.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
  });
});
