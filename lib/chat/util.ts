/**
 * Pure helpers shared between server and client chat code.
 */
import type { ChatView } from "@/lib/chat/types";

export type ChatTimeBucket =
  | "Today"
  | "Yesterday"
  | "Previous 7 days"
  | "Older";

export function bucketChatsByDay<T extends Pick<ChatView, "last_message_at">>(
  chats: T[],
): { bucket: ChatTimeBucket; chats: T[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfPrev7 = new Date(startOfToday);
  startOfPrev7.setDate(startOfPrev7.getDate() - 7);

  const buckets: Record<ChatTimeBucket, T[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  for (const c of chats) {
    const t = new Date(c.last_message_at);
    if (t >= startOfToday) buckets.Today.push(c);
    else if (t >= startOfYesterday) buckets.Yesterday.push(c);
    else if (t >= startOfPrev7) buckets["Previous 7 days"].push(c);
    else buckets.Older.push(c);
  }

  return (Object.keys(buckets) as ChatTimeBucket[])
    .map((bucket) => ({ bucket, chats: buckets[bucket] }))
    .filter((g) => g.chats.length > 0);
}

/** "just now" / "3:14 pm" / "Tue" / "Mon". */
export function relativeTime(iso: string): string {
  const t = new Date(iso);
  const diffMs = Date.now() - t.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const sameDay = t.toDateString() === new Date().toDateString();
  if (sameDay) {
    return t
      .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
      .toLowerCase();
  }
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 7) return t.toLocaleDateString("en-IN", { weekday: "short" });
  return t.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Stable g1/g2/g3 picker for huddle avatars. */
export function huddleVariant(huddleId: string): "g1" | "g2" | "g3" {
  let h = 0;
  for (let i = 0; i < huddleId.length; i++) h = (h * 31 + huddleId.charCodeAt(i)) | 0;
  const variants = ["g1", "g2", "g3"] as const;
  return variants[Math.abs(h) % variants.length];
}

/** Two-letter initials from a name (or fallback to code). */
export function huddleInitials(name: string | null, code: string): string {
  const src = (name && name.trim()) || code;
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/** Cheap title derivation from a user's first message. */
export function deriveChatTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 57).trimEnd() + "…";
}
