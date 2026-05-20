/**
 * Long-term memory reads from `agent_memory`. Step 6g writes into this table
 * via the "Learned: ..." pill flow.
 */
import { createClient } from "@/lib/supabase/server";

export interface MemoryFact {
  id: string;
  fact: string;
  confidence: number;
  source_chat_id: string | null;
  updated_at: string;
}

/**
 * Cap on retained `agent_memory` rows per user. Tuned to:
 *   - hold ~6 months of organic usage at our learned-fact rate, and
 *   - stay well under the system-prompt context budget when we hydrate.
 * Anything older than the {@link MEMORY_RETENTION_LIMIT}-th row gets pruned.
 */
export const MEMORY_RETENTION_LIMIT = 200;

export async function loadTopMemories(
  userId: string,
  limit = 24,
): Promise<MemoryFact[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("agent_memory")
    .select("id, fact, confidence, source_chat_id, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("loadTopMemories:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Prune `agent_memory` so a single user can't accumulate unbounded rows.
 * Keeps the most-recent {@link MEMORY_RETENTION_LIMIT} (by `updated_at`) and
 * deletes everything older. Best-effort — runs fire-and-forget after writes,
 * never blocks the streaming response, and silently no-ops on errors.
 */
export async function pruneAgentMemory(userId: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("agent_memory")
    .select("updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .range(MEMORY_RETENTION_LIMIT - 1, MEMORY_RETENTION_LIMIT - 1);
  if (error || !data || data.length === 0) return;

  const cutoff = data[0].updated_at;
  const { error: delErr } = await supabase
    .from("agent_memory")
    .delete()
    .eq("user_id", userId)
    .lt("updated_at", cutoff);
  if (delErr) {
    console.error("pruneAgentMemory:", delErr.message);
  }
}
