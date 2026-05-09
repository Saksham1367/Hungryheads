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
