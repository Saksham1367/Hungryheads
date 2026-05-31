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
import { loadTopMemories, saveMemoryFacts } from "@/lib/agent/memory";
import { addUserAllergy, removeUserAllergy } from "@/lib/safeplate/allergies";
import { buildChatSystemPrompt } from "@/lib/agent/system-prompts";
import { buildOrderFromToolInput, extractOrderCard } from "@/lib/agent/order-card";
import { extractLearnedFacts } from "@/lib/agent/learned";
import { AGENT_TOOLS, runTool } from "@/lib/agent/tools";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  ACCEPTED_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  classifyAttachment,
  extractAttachmentText,
  imageMediaType,
} from "@/lib/chat/attachments";
import {
  categorizeSdkError,
  describeChatError,
  type ChatErrorCode,
} from "@/lib/chat/errors";
import type Anthropic from "@anthropic-ai/sdk";
import type { Json } from "@/types/database";
import type { ChatAttachmentMeta } from "@/lib/chat/types";
import type {
  ChatMessagePayload,
  ChatMode,
  OrderSummaryPayload,
} from "@/types/domain";

/**
 * Max model round-trips per user message in the tool-use loop. Each "turn" is
 * one streamed Anthropic call. The Food flow can chain several tools
 * (get_addresses → search → menu → cart → coupons), so 4 was too tight — a
 * multi-step ask ran out of turns before producing the final reply. 8 leaves
 * room for the full chain plus the closing answer while staying bounded.
 */
const MAX_TOOL_TURNS = 8;

/**
 * Rate-limit budget per authenticated user.
 *   - 30 requests / 60s sliding window.
 * Streaming responses are slow, so 30/min is generous for any human pattern
 * but throttles a runaway loop (which can burn dozens of $/min on Opus).
 */
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Minimum time (ms) each tool's "doing X…" pill stays on screen.
 *
 * Mock tools return in <10ms, so without this the tool_start → tool_end pair
 * fires in the same network flush; React batches the two state updates and the
 * pill never renders a visible frame. Holding it ~700ms makes the step-by-step
 * pill flow (address → search → menu) actually visible. When live Swiggy MCP
 * lands (Step 12), real network latency usually exceeds this, so it becomes a
 * floor rather than the whole wait.
 */
const MIN_TOOL_PILL_MS = 700;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ParsedInput {
  chatId: string | null;
  text: string;
  mode: ChatMode;
  file: ParsedFile | null;
  /** Regenerate the last agent reply for this chat (no new user message). */
  regenerate: boolean;
  /**
   * Edit & resend: id of an existing user message to rewrite. The server
   * updates its text, deletes everything after it, and re-streams. JSON-only
   * (no attachment changes on edit).
   */
  editMessageId: string | null;
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

  const { text, mode, file, regenerate, editMessageId } = parsed;
  // Regenerate replays the last user turn — no new text/file required. A normal
  // send (or an edit) needs at least text.
  if (!regenerate && !text && !file) {
    return errorResponse("empty_message", 400);
  }
  if ((regenerate || editMessageId) && !parsed.chatId) {
    return errorResponse("history_corrupted", 400);
  }

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
  let imageBlock: Anthropic.Messages.ImageBlockParam | null = null;

  if (file) {
    const kind = classifyAttachment(file.mime, file.filename);
    if (!kind) return errorResponse("unsupported_file", 415);

    attachmentMeta = {
      filename: file.filename,
      mime_type: file.mime,
      size_bytes: file.size,
    };

    if (kind === "image") {
      // Native image (vision) passthrough — this turn only. Persist a marker
      // so future turns know an image was present, but the binary isn't kept.
      const media = imageMediaType(file.mime, file.filename);
      if (!media) return errorResponse("unsupported_file", 415);
      imageBlock = {
        type: "image",
        source: {
          type: "base64",
          media_type: media,
          data: file.buffer.toString("base64"),
        },
      };
      const marker = `<attachment filename="${escapeAttr(file.filename)}" kind="image">[Image analyzed in this turn — binary not retained in history]</attachment>`;
      persistedContent = text ? `${marker}\n\n${text}` : marker;
    } else if (kind === "pdf") {
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
  // The user message id surfaced to the client. On a normal send this is the
  // freshly-inserted row; on regenerate it's the existing last user message.
  let userMessageId = "";

  if (editMessageId) {
    // ── Edit & resend: rewrite a user message, drop everything after it ─────
    // RLS gates ownership (the chat must belong to this user).
    const { data: target, error: targetErr } = await supabase
      .from("chat_messages")
      .select("id, role, created_at")
      .eq("id", editMessageId)
      .eq("chat_id", chatId as string)
      .maybeSingle();
    if (targetErr) {
      console.error("[chat] edit read failed:", targetErr.message);
      return errorResponse("internal", 500);
    }
    if (!target || target.role !== "user") {
      return errorResponse("history_corrupted", 400);
    }

    // Update the edited message's text. Edits are text-only — clear any prior
    // attachment + the old <attachment> wrapper isn't reconstructed here.
    const { error: updErr } = await supabase
      .from("chat_messages")
      .update({ content: text, mode_at_send: mode })
      .eq("id", editMessageId);
    if (updErr) {
      console.error("[chat] edit update failed:", updErr.message);
      return errorResponse("internal", 500);
    }

    // Delete every message strictly AFTER the edited one (agent replies +
    // any later turns) so the conversation re-forks from this point.
    const { error: delErr } = await supabase
      .from("chat_messages")
      .delete()
      .eq("chat_id", chatId as string)
      .gt("created_at", target.created_at);
    if (delErr) {
      console.error("[chat] edit delete failed:", delErr.message);
      return errorResponse("internal", 500);
    }
    userMessageId = editMessageId;
  } else if (regenerate) {
    // ── Regenerate: drop trailing agent message(s), keep the user turn ──────
    // Ownership is enforced by RLS on chat_messages (chat must belong to user).
    const { data: tail, error: tailErr } = await supabase
      .from("chat_messages")
      .select("id, role, created_at")
      .eq("chat_id", chatId as string)
      .order("created_at", { ascending: false })
      .limit(10);
    if (tailErr) {
      console.error("[chat] regenerate read failed:", tailErr.message);
      return errorResponse("internal", 500);
    }
    const rows = tail ?? [];
    // Delete every trailing agent row until we hit the most recent user row.
    const toDelete: string[] = [];
    let lastUserId = "";
    for (const r of rows) {
      if (r.role === "agent") {
        toDelete.push(r.id);
      } else if (r.role === "user") {
        lastUserId = r.id;
        break;
      }
    }
    if (!lastUserId) {
      // Nothing to regenerate from.
      return errorResponse("history_corrupted", 400);
    }
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("chat_messages")
        .delete()
        .in("id", toDelete);
      if (delErr) {
        console.error("[chat] regenerate delete failed:", delErr.message);
        return errorResponse("internal", 500);
      }
    }
    userMessageId = lastUserId;
  } else {
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

    // ─── Persist user message immediately ─────────────────────────────────
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
    userMessageId = userRow.id;

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
  }

  // ─── Build system prompt + history ─────────────────────────────────────
  // By here chatId is always set (created on send, required on regenerate).
  if (!chatId) return errorResponse("internal", 500);
  const resolvedChatId: string = chatId;

  const profile = await loadAgentUserProfile(user.id);
  if (!profile) return errorResponse("profile_missing", 500);
  const memories = await loadTopMemories(user.id, 24);
  const systemPrompt = buildChatSystemPrompt({ profile, memories, mode });

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("chat_id", resolvedChatId)
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

  // For PDFs / images we override the last user turn's content with a
  // content-block array containing the document or image. Everything else
  // stays as a plain string.
  const turnMessages: Anthropic.Messages.MessageParam[] = messages.map(
    (m) => ({ role: m.role, content: m.content }),
  );
  const mediaBlock: Anthropic.Messages.ContentBlockParam | null =
    imageBlock ?? pdfDocumentBlock;
  if (mediaBlock) {
    const lastIdx = turnMessages.length - 1;
    const fallback = imageBlock
      ? "I've attached an image. Please look at it and help me with whatever it shows."
      : "I've attached a document. Please read it and help me with whatever it covers.";
    const textBlock: Anthropic.Messages.TextBlockParam = {
      type: "text",
      text: text || fallback,
    };
    turnMessages[lastIdx] = {
      role: "user",
      content: [mediaBlock, textBlock],
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
        chatId: resolvedChatId,
        userMessageId,
        isNewChat,
      });

      // Multi-turn tool-use loop. Anthropic returns tool_use blocks when it
      // wants to call search_restaurants or get_restaurant_menu — we dispatch
      // against the fixture-backed mock (Step 12 swaps for live MCP) and feed
      // results back. Capped at MAX_TOOL_TURNS to prevent runaway loops.
      let assembled = "";
      // Permanent record of every tool the agent ran for THIS user message.
      // Accumulated across all loop iterations, persisted on the agent row, and
      // streamed in the `done` event so the "Searched restaurants" chips stay
      // visible forever (not just for the <10ms the mock tool takes to return).
      const toolCallRecord: { name: string; ok: boolean }[] = [];
      // Facts the agent chose to remember this turn (via remember_preference).
      // Persisted post-loop through saveMemoryFacts (deduped) and surfaced as
      // the "Learned:" pill.
      const learnedThisTurn: string[] = [];
      // Order card proposed this turn via the propose_order tool (the reliable
      // path). The server builds + validates it; preferred over the legacy
      // <order-summary> string at persistence time.
      let proposedOrder: OrderSummaryPayload | null = null;
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

            // update_allergy is a HungryHeads-internal SAFETY tool — it writes
            // to user_allergies, the structured table SafePlate hard-blocks
            // against at checkout. Handled here (async) rather than in the sync
            // runTool dispatcher.
            if (tu.name === "update_allergy") {
              const algStart = Date.now();
              const algInput = (tu.input ?? {}) as {
                allergen?: unknown;
                action?: unknown;
                severity?: unknown;
              };
              const allergen =
                typeof algInput.allergen === "string"
                  ? algInput.allergen.trim()
                  : "";
              const action = algInput.action === "remove" ? "remove" : "add";
              const severity =
                algInput.severity === "medium" || algInput.severity === "low"
                  ? algInput.severity
                  : "high";

              let algOk = false;
              let resultMsg = "allergen was empty — nothing changed";
              let storedLabel = allergen;
              if (allergen) {
                const res =
                  action === "remove"
                    ? await removeUserAllergy(user.id, allergen)
                    : await addUserAllergy(user.id, allergen, severity);
                algOk = res.ok;
                storedLabel = res.allergen || allergen;
                if (res.ok) {
                  resultMsg =
                    action === "remove"
                      ? `Removed ${storedLabel} from SafePlate.`
                      : `${storedLabel} is now hard-blocked by SafePlate.`;
                  // Surface a live "SafePlate updated" pill on the turn.
                  send({
                    type: "allergy_saved",
                    allergen: storedLabel,
                    action,
                  });
                } else {
                  resultMsg = res.error ?? "could not update allergy";
                }
              }
              toolCallRecord.push({ name: tu.name, ok: algOk });
              const algElapsed = Date.now() - algStart;
              if (algElapsed < MIN_TOOL_PILL_MS) {
                await sleep(MIN_TOOL_PILL_MS - algElapsed);
              }
              send({ type: "tool_end", name: tu.name, ok: algOk });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify(
                  algOk
                    ? { ok: true, action, allergen: storedLabel, note: resultMsg }
                    : { error: resultMsg },
                ),
                is_error: !algOk,
              });
              continue;
            }

            // remember_preference is a HungryHeads-internal tool (it writes to
            // our agent_memory, not Swiggy MCP), so it's handled here rather
            // than through the synchronous runTool dispatcher.
            if (tu.name === "remember_preference") {
              const memStart = Date.now();
              const memInput = (tu.input ?? {}) as { fact?: unknown };
              const fact =
                typeof memInput.fact === "string" ? memInput.fact.trim() : "";
              let memOk = false;
              if (fact) {
                learnedThisTurn.push(fact);
                send({ type: "memory_saved", fact });
                memOk = true;
              }
              toolCallRecord.push({ name: tu.name, ok: memOk });
              const memElapsed = Date.now() - memStart;
              if (memElapsed < MIN_TOOL_PILL_MS) {
                await sleep(MIN_TOOL_PILL_MS - memElapsed);
              }
              send({ type: "tool_end", name: tu.name, ok: memOk });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify(
                  memOk
                    ? { ok: true, remembered: fact }
                    : { error: "fact was empty — nothing saved" },
                ),
                is_error: !memOk,
              });
              continue;
            }

            // propose_order is a HungryHeads-internal tool — the SERVER builds
            // and validates the order card from the model's items + fees
            // (computing the math + enforcing the ₹1000 cap), so a truncated
            // reply or bad arithmetic can never produce a broken card. On
            // rejection the error is fed back so the model revises.
            if (tu.name === "propose_order") {
              const ordStart = Date.now();
              const built = buildOrderFromToolInput(tu.input);
              const ordOk = built.order !== null;
              if (built.order) {
                // Last proposal wins if the model somehow calls twice.
                proposedOrder = built.order;
              }
              toolCallRecord.push({ name: tu.name, ok: ordOk });
              const ordElapsed = Date.now() - ordStart;
              if (ordElapsed < MIN_TOOL_PILL_MS) {
                await sleep(MIN_TOOL_PILL_MS - ordElapsed);
              }
              send({ type: "tool_end", name: tu.name, ok: ordOk });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify(
                  built.order
                    ? {
                        ok: true,
                        note: "Order card shown to the user with a confirm button.",
                        subtotal: built.order.subtotal,
                        total: built.order.total,
                      }
                    : { error: built.error },
                ),
                is_error: !ordOk,
              });
              continue;
            }

            // Hold the pill long enough to be seen — mock tools are instant, so
            // run the tool, then ensure the pill was visible for a minimum
            // duration before clearing it. Each tool gets its own visible pill.
            const startedAt = Date.now();
            const result = runTool(tu.name, tu.input, { userId: user.id });
            toolCallRecord.push({ name: tu.name, ok: result.ok });
            const elapsed = Date.now() - startedAt;
            if (elapsed < MIN_TOOL_PILL_MS) {
              await sleep(MIN_TOOL_PILL_MS - elapsed);
            }
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
            chat_id: resolvedChatId,
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
          .eq("id", resolvedChatId);

        send({
          type: "error",
          code,
          message: info.detail,
          agentMessageId: errorRow?.id ?? null,
          chatId: resolvedChatId,
        });
        controller.close();
        return;
      }

      // Strip the trailing markers from the agent reply BEFORE saving.
      //   1. <order-summary>{...}</order-summary>  → chat_messages.payload
      //   2. LEARNED: <fact>                       → chat_messages.learned_fact
      //                                              + agent_memory rows
      // Legacy <order-summary> string is still parsed as a fallback — strips
      // the block from the saved body and yields an order if the model used the
      // old format. The propose_order tool (proposedOrder) takes precedence.
      const orderParsed = extractOrderCard(assembled);
      // Legacy LEARNED: string is still parsed as a fallback — it strips the
      // line from the saved body and feeds the same memory pipeline as the
      // remember_preference tool.
      const learnedParsed = extractLearnedFacts(orderParsed.cleanedContent);
      const finalContent = learnedParsed.cleanedContent;

      // Memory facts come from two sources, in priority order:
      //   1. remember_preference tool calls this turn (the reliable path)
      //   2. legacy LEARNED: lines (fallback for older prompt behaviour)
      const allLearned = [...learnedThisTurn, ...learnedParsed.facts];
      const displayedFact = allLearned[0] ?? null;

      // Order card, in priority order:
      //   1. propose_order tool this turn (server-built + cap-checked)
      //   2. legacy <order-summary> string (fallback)
      const finalOrder = proposedOrder ?? orderParsed.order;
      const payload: ChatMessagePayload | null = finalOrder
        ? { type: "order_summary", data: finalOrder }
        : null;

      // Persist agent message — including the permanent tool-call record so
      // the activity chips survive reloads and chat-switches.
      const { data: agentRow, error: agentErr } = await supabase
        .from("chat_messages")
        .insert({
          chat_id: resolvedChatId,
          role: "agent",
          content: finalContent,
          mode_at_send: mode,
          payload: payload as unknown as Json,
          learned_fact: displayedFact,
          tool_calls:
            toolCallRecord.length > 0
              ? (toolCallRecord as unknown as Json)
              : null,
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

      // Persist learned facts to agent_memory (deduped against what's already
      // stored) so future system prompts recall them. Best-effort — a memory
      // hiccup never breaks the chat reply. saveMemoryFacts prunes internally.
      if (allLearned.length > 0) {
        await saveMemoryFacts(user.id, resolvedChatId, allLearned);
      }

      // Touch chat metadata
      await supabase
        .from("chats")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", resolvedChatId);

      send({
        type: "done",
        agentMessageId: agentRow.id,
        content: finalContent,
        chatId: resolvedChatId,
        order: finalOrder,
        orderParseError: proposedOrder ? null : orderParsed.parseError,
        learned: displayedFact,
        toolCalls: toolCallRecord,
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
        const okExt = /\.(pdf|docx?|xlsx?|csv|jpe?g|png|gif|webp)$/i.test(
          blob.name,
        );
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

    return {
      chatId,
      text,
      mode,
      file,
      regenerate: false,
      editMessageId: null,
    };
  }

  // JSON path (no attachment).
  const body = (await request.json()) as {
    chatId?: string | null;
    text?: string;
    mode?: string;
    regenerate?: boolean;
    editMessageId?: string | null;
  };
  const text = (body.text ?? "").trim();
  const modeStr = typeof body.mode === "string" ? body.mode : "";
  const mode: ChatMode = isChatMode(modeStr) ? modeStr : "hungry";
  return {
    chatId: body.chatId ?? null,
    text,
    mode,
    file: null,
    regenerate: body.regenerate === true,
    editMessageId:
      typeof body.editMessageId === "string" && body.editMessageId
        ? body.editMessageId
        : null,
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
