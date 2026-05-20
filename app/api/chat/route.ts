/**
 * POST /api/chat
 *
 * Live Anthropic streaming agent.
 *
 * Body: { chatId: string | null, text: string, mode: ChatMode }
 * Response: text/event-stream of JSON-encoded events:
 *   { type: "start", chatId, userMessageId }       — once, after user msg persists
 *   { type: "delta", text }                         — many, while Claude streams
 *   { type: "done", agentMessageId, content }      — once, after agent persists
 *   { type: "error", message }                     — on any failure
 *
 * Persistence happens server-side here, NOT via the dashboard server action.
 * This file replaces `sendMessage` for the message-send path; the server action
 * stays for `createChat` / `updateChatMode` / `deleteChat`.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isChatMode } from "@/lib/chat/modes";
import { deriveChatTitle } from "@/lib/chat/util";
import { anthropicClient, DEFAULT_MAX_TOKENS, DEFAULT_MODEL } from "@/lib/agent/anthropic";
import { loadAgentUserProfile } from "@/lib/agent/profile";
import { loadTopMemories, pruneAgentMemory } from "@/lib/agent/memory";
import { buildChatSystemPrompt } from "@/lib/agent/system-prompts";
import { extractOrderCard } from "@/lib/agent/order-card";
import { extractLearnedFacts } from "@/lib/agent/learned";
import { AGENT_TOOLS, runTool } from "@/lib/agent/tools";
import { checkRateLimit } from "@/lib/ratelimit";
import type Anthropic from "@anthropic-ai/sdk";
import type { Json } from "@/types/database";
import type { ChatMessagePayload, ChatMode } from "@/types/domain";

const MAX_TOOL_TURNS = 4;

/**
 * Rate-limit budget per authenticated user.
 *   - 30 requests / 60s sliding window.
 * Streaming responses are slow, so 30/min is generous for any human pattern
 * but throttles a runaway loop (which can burn dozens of $/min on Opus).
 */
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequest {
  chatId: string | null;
  text: string;
  mode: ChatMode;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // ─── Parse + validate ───────────────────────────────────────────────────
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return errorResponse("invalid_json", 400);
  }

  const text = (body.text ?? "").trim();
  if (!text) return errorResponse("empty_message", 400);
  const mode: ChatMode = isChatMode(body.mode) ? body.mode : "hungry";

  // ─── Auth ───────────────────────────────────────────────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("unauthorized", 401);

  // ─── Rate limit (per authenticated user) ────────────────────────────────
  const rl = checkRateLimit(
    `chat:${user.id}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: "rate_limited",
        message: `Slow down — try again in ${rl.retryAfterSeconds}s.`,
        retryAfterSeconds: rl.retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfterSeconds),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  // ─── Resolve / create chat ──────────────────────────────────────────────
  let chatId = body.chatId;
  let isNewChat = false;
  if (!chatId) {
    const { data, error } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        mode,
        title: deriveChatTitle(text),
      })
      .select("id")
      .single();
    if (error || !data) return errorResponse(`create_chat:${error?.message}`, 500);
    chatId = data.id;
    isNewChat = true;
  }

  // ─── Persist user message immediately ───────────────────────────────────
  const { data: userRow, error: userErr } = await supabase
    .from("chat_messages")
    .insert({
      chat_id: chatId,
      role: "user",
      content: text,
      mode_at_send: mode,
    })
    .select("id, created_at")
    .single();
  if (userErr || !userRow) return errorResponse(`user_insert:${userErr?.message}`, 500);

  // First user message in chat? Update title.
  if (!isNewChat) {
    const { count } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", chatId)
      .eq("role", "user");
    if ((count ?? 0) <= 1) {
      await supabase
        .from("chats")
        .update({ title: deriveChatTitle(text), mode })
        .eq("id", chatId);
    }
  }

  // ─── Build system prompt + history ─────────────────────────────────────
  const profile = await loadAgentUserProfile(user.id);
  if (!profile) return errorResponse("profile_missing", 500);
  const memories = await loadTopMemories(user.id, 24);
  const systemPrompt = buildChatSystemPrompt({ profile, memories, mode });

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  // Anthropic expects alternating user/assistant. Filter to chat roles
  // and convert. The just-persisted user message is the last entry.
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const row of history ?? []) {
    if (row.role !== "user" && row.role !== "agent") continue;
    const r: "user" | "assistant" = row.role === "agent" ? "assistant" : "user";
    if (messages.length && messages[messages.length - 1].role === r) {
      // Same role twice in a row — collapse into one to satisfy the API.
      messages[messages.length - 1].content += "\n\n" + row.content;
    } else {
      messages.push({ role: r, content: row.content });
    }
  }
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return errorResponse("history_corrupted", 500);
  }

  // ─── Stream ─────────────────────────────────────────────────────────────
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      send({
        type: "start",
        chatId,
        userMessageId: userRow.id,
        isNewChat,
      });

      // Multi-turn tool-use loop. Anthropic returns tool_use blocks when it
      // wants to call search_restaurants or get_restaurant_menu — we dispatch
      // against the fixture-backed mock (Step 12 swaps for live MCP) and feed
      // results back. Capped at MAX_TOOL_TURNS to prevent runaway loops.
      let assembled = "";
      const turnMessages: Anthropic.Messages.MessageParam[] = messages.map(
        (m) => ({ role: m.role, content: m.content }),
      );
      try {
        const anthropic = anthropicClient();
        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
          const claude = anthropic.messages.stream({
            model: DEFAULT_MODEL,
            max_tokens: DEFAULT_MAX_TOKENS,
            system: systemPrompt,
            messages: turnMessages,
            tools: AGENT_TOOLS,
          });

          for await (const event of claude) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const piece = event.delta.text;
              assembled += piece;
              send({ type: "delta", text: piece });
            }
          }

          const finalMsg = await claude.finalMessage();
          if (finalMsg.stop_reason !== "tool_use") {
            // Conversation done — agent gave a final reply (text only).
            break;
          }

          // Append the assistant turn (text + tool_use blocks) to history.
          turnMessages.push({ role: "assistant", content: finalMsg.content });

          // Run each requested tool, build tool_result blocks.
          const toolUseBlocks = finalMsg.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
          );
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const tu of toolUseBlocks) {
            send({ type: "tool_start", name: tu.name });
            const result = runTool(tu.name, tu.input, { userId: user.id });
            send({
              type: "tool_end",
              name: tu.name,
              ok: result.ok,
            });
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify(
                result.ok ? result.data : { error: result.error },
              ),
              is_error: !result.ok,
            });
          }

          // Feed tool results in as the next user message.
          turnMessages.push({ role: "user", content: toolResults });

          // Visual separator before Claude resumes streaming text in the
          // next turn. Without this, "Now let me search!" from turn N runs
          // straight into "Found 3 spots…" from turn N+1 — looks like one
          // run-on sentence with no paragraph break around tool calls.
          if (toolUseBlocks.length > 0) {
            const sep = "\n\n";
            assembled += sep;
            send({ type: "delta", text: sep });
          }

          // Loop continues — next iteration streams the agent's follow-up.
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream_failed";
        send({ type: "error", message: msg });
        controller.close();
        return;
      }

      // Strip the trailing markers from the agent reply BEFORE saving.
      //   1. <order-summary>{...}</order-summary>  → chat_messages.payload
      //   2. LEARNED: <fact>                       → chat_messages.learned_fact
      //                                              + agent_memory rows
      const orderParsed = extractOrderCard(assembled);
      const learnedParsed = extractLearnedFacts(orderParsed.cleanedContent);
      const finalContent = learnedParsed.cleanedContent;

      const payload: ChatMessagePayload | null = orderParsed.order
        ? { type: "order_summary", data: orderParsed.order }
        : null;
      const displayedFact = learnedParsed.facts[0] ?? null;

      // Persist agent message
      const { data: agentRow, error: agentErr } = await supabase
        .from("chat_messages")
        .insert({
          chat_id: chatId,
          role: "agent",
          content: finalContent,
          mode_at_send: mode,
          payload: payload as unknown as Json,
          learned_fact: displayedFact,
        })
        .select("id, created_at")
        .single();
      if (agentErr || !agentRow) {
        send({
          type: "error",
          message: `agent_insert:${agentErr?.message ?? "unknown"}`,
        });
        controller.close();
        return;
      }

      // Persist every learned fact to agent_memory so future system prompts
      // can recall them. Best-effort — failure here doesn't break the chat.
      if (learnedParsed.facts.length > 0) {
        const rows = learnedParsed.facts.map((fact) => ({
          user_id: user.id,
          fact,
          source_chat_id: chatId,
          confidence: 0.85,
        }));
        await supabase.from("agent_memory").insert(rows);
        // Cap retained rows per user (fire-and-forget — don't block the stream).
        void pruneAgentMemory(user.id);
      }

      // Touch chat metadata
      await supabase
        .from("chats")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", chatId);

      send({
        type: "done",
        agentMessageId: agentRow.id,
        content: finalContent,
        chatId,
        order: orderParsed.order,
        orderParseError: orderParsed.parseError,
        learned: displayedFact,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function errorResponse(code: string, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
