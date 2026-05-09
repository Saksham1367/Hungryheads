/**
 * Client-side SSE consumer for /api/chat.
 *
 * Reads `data: {...}\n\n` event frames from a fetch ReadableStream and yields
 * them as decoded JSON. Cancels cleanly via the AbortSignal.
 */
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
  | { type: "error"; message: string };

export async function* streamChat(
  input: { chatId: string | null; text: string; mode: string },
  signal: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });

  if (!res.ok) {
    let msg = `http_${res.status}`;
    try {
      const j = await res.json();
      if (typeof j?.error === "string") msg = j.error;
    } catch {
      /* ignore */
    }
    yield { type: "error", message: msg };
    return;
  }
  if (!res.body) {
    yield { type: "error", message: "no_response_body" };
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
        yield parsed;
      } catch {
        // skip malformed frame
      }
    }
  }
}
