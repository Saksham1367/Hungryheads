"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChatMode } from "@/lib/chat/modes";
import { loadChatMessages, loadEarlierChatMessages } from "@/lib/chat/queries";
import type { ChatMessageView } from "@/lib/chat/types";
import type { ChatMode } from "@/types/domain";
import type { Json } from "@/types/database";

// ─── Create chat ────────────────────────────────────────────────────────────
export async function createChat(mode: ChatMode = "hungry"): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!isChatMode(mode)) mode = "hungry";

  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: user.id, mode })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create chat");
  }
  revalidatePath("/dashboard");
  return data.id;
}

// ─── Update chat mode ───────────────────────────────────────────────────────
export async function updateChatMode(chatId: string, mode: ChatMode) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!isChatMode(mode)) return;

  await supabase
    .from("chats")
    .update({ mode })
    .eq("id", chatId)
    .eq("user_id", user.id);
  revalidatePath("/dashboard");
}

// ─── Rename chat ────────────────────────────────────────────────────────────
export type RenameChatResult =
  | { ok: true; title: string }
  | { ok: false; error: string };

export async function renameChat(
  chatId: string,
  rawTitle: string,
): Promise<RenameChatResult> {
  const title = rawTitle.trim();
  if (title.length === 0) {
    return { ok: false, error: "Title can't be empty." };
  }
  if (title.length > 80) {
    return { ok: false, error: "Keep it under 80 characters." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { error, data } = await supabase
    .from("chats")
    .update({ title })
    .eq("id", chatId)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Chat not found." };
  }

  revalidatePath("/dashboard");
  return { ok: true, title };
}

// ─── Load earlier messages (pagination) ─────────────────────────────────────
export type LoadEarlierResult =
  | { ok: true; messages: ChatMessageView[]; hasMore: boolean }
  | { ok: false; error: string };

export async function loadEarlierMessagesAction(
  chatId: string,
  beforeCreatedAt: string,
): Promise<LoadEarlierResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  // Ownership gate — RLS would block too, but a clean error is friendlier.
  const { data: chat } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!chat) return { ok: false, error: "Chat not found." };

  const page = await loadEarlierChatMessages(chatId, beforeCreatedAt);
  return { ok: true, messages: page.messages, hasMore: page.hasMore };
}

// ─── Share chat (snapshot → public link) ────────────────────────────────────
export type ShareChatResult =
  | { ok: true; token: string; url: string }
  | { ok: false; error: string };

/**
 * Freeze the current chat into `chat_shares.snapshot` and return a token URL.
 * The snapshot is immutable so editing/deleting the chat later doesn't change
 * what the recipient sees. Token is 16 url-safe bytes ≈ 22 chars.
 */
export async function shareChat(chatId: string): Promise<ShareChatResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data: chat } = await supabase
    .from("chats")
    .select("id, title")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!chat) return { ok: false, error: "Chat not found." };

  // Snapshot the whole chat — we already cap at CHAT_PAGE_SIZE*N in practice,
  // and a single chat's messages will fit comfortably in jsonb.
  const { messages } = await loadChatMessages(chatId, 1000);
  if (messages.length === 0) {
    return { ok: false, error: "Nothing to share yet — say something first." };
  }

  const token = randomBytes(16).toString("base64url");
  const { error: insErr } = await supabase.from("chat_shares").insert({
    chat_id: chatId,
    shared_by: user.id,
    token,
    title: chat.title,
    snapshot: messages as unknown as Json,
  });
  if (insErr) return { ok: false, error: insErr.message };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { ok: true, token, url: `${base}/share/${token}` };
}

// ─── Delete chat ────────────────────────────────────────────────────────────
export async function deleteChat(chatId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  await supabase.from("chats").delete().eq("id", chatId).eq("user_id", user.id);
  revalidatePath("/dashboard");
}
