/**
 * Client-side SSE consumer for /api/chat.
 *
 * Reads `data: {...}\n\n` event frames from a fetch ReadableStream and yields
 * them as decoded JSON. Cancels cleanly via the AbortSignal.
 */
import { isChatErrorCode, type ChatErrorCode } from "@/lib/chat/errors";
import type { OrderSummaryPayload } from "@/types/domain";

export type ChatStreamEvent =
  | { type: "start"; chatId: string; userMessageId: string; isNewChat: boolean }
  | { type: "delta"; text: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_end"; name: string; ok: boolean }
  | {
      type: "done";
      chatId: string;
      agentMessageId: string;
      content: string;
      /** Parsed order card if the agent ended its reply with `<order-summary>...`. */
      order?: OrderSummaryPayload | null;
      /** Set when the marker was present but JSON failed validation. */
      orderParseError?: string | null;
      /** First `LEARNED: <fact>` line emitted (others persisted to agent_memory). */
      learned?: string | null;
    }
  | {
      type: "error";
      code: ChatErrorCode;
      message: string;
      /** Set when the server managed to persist a failed-turn agent row. */
      agentMessageId?: string | null;
      chatId?: string | null;
    };

export async function* streamChat(
  input: {
    chatId: string | null;
    text: string;
    mode: string;
    /** Optional file attachment. When set, the request is sent as multipart. */
    file?: File | null;
  },
  signal: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, void> {
  let res: Response;
  if (input.file) {
    const form = new FormData();
    form.set("chatId", input.chatId ?? "");
    form.set("text", input.text);
    form.set("mode", input.mode);
    form.set("file", input.file, input.file.name);
    // Don't set Content-Type — the browser fills in the multipart boundary.
    res = await fetch("/api/chat", { method: "POST", body: form, signal });
  } else {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: input.chatId,
        text: input.text,
        mode: input.mode,
      }),
      signal,
    });
  }

  if (!res.ok) {
    const code = await readHttpErrorCode(res);
    yield { type: "error", code, message: code };
    return;
  }
  if (!res.body) {
    yield { type: "error", code: "internal", message: "no_response_body" };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = frame
        .split("\n")
        .find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      try {
        const parsed = JSON.parse(dataLine.slice(6)) as ChatStreamEvent;
        // Defensive: if the server didn't include a code, fall back.
        if (parsed.type === "error" && !isChatErrorCode(parsed.code)) {
          yield { type: "error", code: "unknown", message: parsed.message };
        } else {
          yield parsed;
        }
      } catch {
        // skip malformed frame
      }
    }
  }
}

/**
 * Read the error body from a non-2xx /api/chat response and pick a
 * {@link ChatErrorCode}. Falls back to a status-based bucket if the body is
 * missing or malformed.
 */
async function readHttpErrorCode(res: Response): Promise<ChatErrorCode> {
  try {
    const j = (await res.json()) as { error?: unknown };
    if (isChatErrorCode(j?.error)) return j.error;
  } catch {
    /* fall through */
  }
  if (res.status === 401 || res.status === 403) return "auth";
  if (res.status === 429) return "rate_limited";
  if (res.status === 413) return "file_too_large";
  if (res.status === 415) return "unsupported_file";
  if (res.status >= 500) return "internal";
  return "unknown";
}
