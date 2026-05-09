import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatShell } from "@/components/chat/shell";
import { loadDashboard } from "@/lib/chat/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { chat?: string; new?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded, full_name")
    .eq("id", user.id)
    .single();
  if (profile && !profile.onboarded) redirect("/onboarding");

  const fullName =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "Friend";
  const initial = fullName.charAt(0).toUpperCase();

  const forceNew = searchParams?.new === "1";
  const dash = await loadDashboard(searchParams?.chat, forceNew);

  // `key` on the client shell forces a remount when the active chat changes —
  // otherwise its useState would keep stale `activeChat` / `messages` values
  // after a soft-navigation. Sidebar order + Mode picker still update because
  // their props pass through fresh.
  // The `key` forces ChatShell to remount whenever the URL semantically points
  // at a different conversation (specific chat, blank-slate new, or
  // most-recent fallback). Without this, useState would hold stale state
  // across soft-navigations.
  const shellKey = forceNew
    ? "new"
    : dash.activeChat?.id ?? "empty";

  return (
    <ChatShell
      key={shellKey}
      userInitial={initial}
      userFullName={fullName}
      initialChats={dash.chats}
      initialHuddles={dash.huddles}
      initialActiveChat={dash.activeChat}
      initialMessages={dash.activeMessages}
      budgetUsedPct={dash.budgetUsedPct}
      overview={dash.overview}
    />
  );
}
