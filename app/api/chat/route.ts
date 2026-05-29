/**
 * POST /api/chat
 *
 * Live Anthropic streaming agent.
 *
 * Two content-types are accepted:
 *   - application/json:        { chatId, text, mode }
 *   - multipart/form-data:     chatId, text, mode + optional `file` (one
 *                              PDF / DOC(X) / XLS(X) / CSV up to 5 MB)
 *
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
import {
  ACCEPTED_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  classifyAttachment,
  extractAttachmentText,
} from "@/lib/chat/attachments";
import {
  categorizeSdkError,
  describeChatError,
  type ChatErrorCode,
} from "@/lib/chat/errors";
import type Anthropic from "@anthropic-ai/sdk";
import type { Json } from "@/types/database";
import type { ChatAttachmentMeta } from "@/lib/chat/types";
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

interface ParsedInput {
  chatId: string | null;
  text: string;
  mode: ChatMode;
  file: ParsedFile | null;
}

interface ParsedFile {
  buffer: Buffer;
  filename: string;
  mime: string;
  size: number;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // ─── Parse + validate ───────────────────────────────────────────────────
  let parsed: ParsedInput;
  try {
    parsed = await parseInput(request);
  } catch (err) {
    const code =
      err instanceof Error && isKnownParseCode(err.message)
        ? (err.message as ChatErrorCode)
        : "internal";
    const status =
      code === "file_too_large" ? 413 : code === "unsupported_file" ? 415 : 400;
    return errorResponse(code, status);
  }

  const { text, mode, file } = parsed;
  if (!text && !file) return errorResponse("empty_message", 400);

  // ─── Auth ───────────────────────────────────────────────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("auth", 401);

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

  // ─── Process attachment (extract text, build content blocks) ────────────
  let persistedContent = text;
  let attachmentMeta: ChatAttachmentMeta | null = null;
  let pdfDocumentBlock: Anthropic.Messages.DocumentBlockParam | null = null;

  if (file) {
    const kind = classifyAttachment(file.mime, file.filename);
    if (!kind) return errorResponse("unsupported_file", 415);

    attachmentMeta = {
      filename: file.filename,
      mime_type: file.mime,
      size_bytes: file.size,
    };

    if (kind === "pdf") {
      // Native PDF passthrough — this turn only. Persist a marker so future
      // turns know an attachment was present, but the binary isn't retained.
      pdfDocumentBlock = {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: file.buffer.toString("base64"),
        },
      };
      const marker = `<attachment filename="${escapeAttr(file.filename)}" kind="pdf">[PDF analyzed in this turn — binary not retained in history]</attachment>`;
      persistedContent = text ? `${marker}\n\n${text}` : marker;
    } else {
      // Extract text and wrap in an <attachment> block. Stored verbatim in
      // chat_messages.content so future turns can refer back to the data.
      try {
        const extracted = await extractAttachmentText(kind, file.buffer);
        const body =
          extracted.text + (extracted.truncated ? "\n\n[...truncated]" : "");
        const block = `<attachment filename="${escapeAttr(file.filename)}" kind="${kind}">${body}</attachment>`;
        persistedContent = text ? `${block}\n\n${text}` : block;
      } catch (err) {
        console.error("[chat] attachment_parse failed:", err);
        return errorResponse("attachment_parse", 422);
      }
    }
  }

  // ─── Resolve / create chat ──────────────────────────────────────────────
  let chatId = parsed.chatId;
  let isNewChat = false;
  if (!chatId) {
    const titleSeed = text || file?.filename || "New chat";
    const { data, error } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        mode,
        title: deriveChatTitle(titleSeed),
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[chat] create_chat failed:", error?.message);
      return errorResponse("internal", 500);
    }
    chatId = data.id;
    isNewChat = true;
  }

  // ─── Persist user message immediately ───────────────────────────────────
  const { data: userRow, error: userErr } = await supabase
    .from("chat_messages")
    .insert({
      chat_id: chatId,
      role: "user",
      content: persistedContent,
      mode_at_send: mode,
      attachment: attachmentMeta as unknown as Json,
    })
    .select("id, created_at")
    .single();
  if (userErr || !userRow) {
    console.error("[chat] user_insert failed:", userErr?.message);
    return errorResponse("internal", 500);
  }

  // First user message in chat? Update title.
  if (!isNewChat) {
    const { count } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", chatId)
      .eq("role", "user");
    if ((count ?? 0) <= 1) {
      const titleSeed = text || file?.filename || "New chat";
      await supabase
        .from("chats")
        .update({ title: deriveChatTitle(titleSeed), mode })
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

  // For PDFs we override the last user turn's content with a content-block
  // array containing the document. Everything else stays as a plain string.
  const turnMessages: Anthropic.Messages.MessageParam[] = messages.map(
    (m) => ({ role: m.role, content: m.content }),
  );
  if (pdfDocumentBlock) {
    const lastIdx = turnMessages.length - 1;
    const textBlock: Anthropic.Messages.TextBlockParam = {
      type: "text",
      text:
        text ||
        "I've attached a document. Please read it and help me with whatever it covers.",
    };
    turnMessages[lastIdx] = {
      role: "user",
      content: [pdfDocumentBlock, textBlock],
    };
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
        console.error("[chat] stream failed:", err);
        const code = categorizeSdkError(err);
        const info = describeChatError(code);

        // Persist a failed agent turn so the error survives chat-switches
        // and reloads. Stores any partial streamed text in `content` plus
        // the full error in `payload` (type: "error").
        const errorPayload: ChatMessagePayload = {
          type: "error",
          error: {
            code: info.code,
            title: info.title,
            detail: info.detail,
            retryable: info.retryable,
          },
        };
        const { data: errorRow, error: insertErr } = await supabase
          .from("chat_messages")
          .insert({
            chat_id: chatId,
            role: "agent",
            content: assembled,
            mode_at_send: mode,
            payload: errorPayload as unknown as Json,
          })
          .select("id")
          .single();
        if (insertErr) {
          console.error("[chat] persist error row failed:", insertErr.message);
        }

        // Touch chat metadata so the sidebar sorts this conversation up top.
        await supabase
          .from("chats")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", chatId);

        send({
          type: "error",
          code,
          message: info.detail,
          agentMessageId: errorRow?.id ?? null,
          chatId,
        });
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
        console.error("[chat] agent_insert failed:", agentErr?.message);
        const info = describeChatError("internal");
        send({ type: "error", code: "internal", message: info.detail });
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

// ─── Helpers ──────────────────────────────────────────────────────────────

async function parseInput(request: NextRequest): Promise<ParsedInput> {
  const ct = request.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const text = String(form.get("text") ?? "").trim();
    const rawMode = form.get("mode");
    const modeStr = typeof rawMode === "string" ? rawMode : "";
    const mode: ChatMode = isChatMode(modeStr) ? modeStr : "hungry";
    const rawChatId = form.get("chatId");
    const chatId =
      typeof rawChatId === "string" && rawChatId && rawChatId !== "null"
        ? rawChatId
        : null;

    let file: ParsedFile | null = null;
    const f = form.get("file");
    if (f && typeof f === "object" && "arrayBuffer" in f) {
      const blob = f as File;
      if (blob.size > 0) {
        if (blob.size > MAX_ATTACHMENT_BYTES) {
          throw new Error("file_too_large");
        }
        // Accept by MIME OR by extension fallback. Some browsers/OSes report
        // empty/odd MIMEs for DOC/XLS — `classifyAttachment` does the final
        // check on both signals.
        const knownMime = ACCEPTED_MIME_TYPES.has(blob.type);
        const okExt = /\.(pdf|docx?|xlsx?|csv)$/i.test(blob.name);
        if (!knownMime && !okExt) {
          throw new Error("unsupported_file");
        }
        const buf = Buffer.from(await blob.arrayBuffer());
        file = {
          buffer: buf,
          filename: blob.name,
          mime: blob.type || "application/octet-stream",
          size: blob.size,
        };
      }
    }

    return { chatId, text, mode, file };
  }

  // JSON path (no attachment).
  const body = (await request.json()) as {
    chatId?: string | null;
    text?: string;
    mode?: string;
  };
  const text = (body.text ?? "").trim();
  const modeStr = typeof body.mode === "string" ? body.mode : "";
  const mode: ChatMode = isChatMode(modeStr) ? modeStr : "hungry";
  return {
    chatId: body.chatId ?? null,
    text,
    mode,
    file: null,
  };
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const PARSE_ERROR_CODES = new Set<string>([
  "file_too_large",
  "unsupported_file",
]);

function isKnownParseCode(code: string): code is ChatErrorCode {
  return PARSE_ERROR_CODES.has(code);
}

function errorResponse(code: ChatErrorCode, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
