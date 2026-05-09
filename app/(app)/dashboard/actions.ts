"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChatMode } from "@/lib/chat/modes";
import type { ChatMode } from "@/types/domain";

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

// ─── Delete chat ────────────────────────────────────────────────────────────
export async function deleteChat(chatId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  await supabase.from("chats").delete().eq("id", chatId).eq("user_id", user.id);
  revalidatePath("/dashboard");
}
