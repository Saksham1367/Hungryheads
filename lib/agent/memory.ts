/**
 * Long-term memory for the agent — reads + writes to `agent_memory`.
 *
 * Writes happen via the `remember_preference` tool (the reliable path) with a
 * legacy `LEARNED:` string fallback. Both funnel through {@link saveMemoryFacts},
 * which dedupes against what's already stored before inserting.
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

// ─── Writes ───────────────────────────────────────────────────────────────

/**
 * Normalise a fact for dedupe comparison: lowercase, strip punctuation,
 * collapse whitespace. Catches "Loves Thai food." == "loves thai food" but
 * NOT semantic near-duplicates ("loves Thai" vs "is a fan of Thai") — that
 * needs embeddings (a later batch). Good enough to stop the obvious repeats.
 */
function normalizeFact(fact: string): string {
  return fact
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Persist a batch of learned facts to `agent_memory`, deduped against what the
 * user already has stored. New facts are inserted; facts that already exist get
 * their `updated_at` bumped (so recency-ordered recall keeps them fresh).
 * Returns the facts that were newly inserted (for logging / display).
 *
 * Best-effort: errors are logged, never thrown — a memory hiccup must not break
 * the chat reply.
 */
export async function saveMemoryFacts(
  userId: string,
  sourceChatId: string,
  facts: string[],
  confidence = 0.85,
): Promise<string[]> {
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const raw of facts) {
    const fact = raw.trim();
    if (!fact || fact.length > 240) continue;
    const norm = normalizeFact(fact);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    cleaned.push(fact);
  }
  if (cleaned.length === 0) return [];

  const supabase = createClient();

  // Pull existing facts to dedupe against (and to bump recency on repeats).
  const { data: existing, error: readErr } = await supabase
    .from("agent_memory")
    .select("id, fact")
    .eq("user_id", userId);
  if (readErr) {
    console.error("saveMemoryFacts read:", readErr.message);
  }
  const existingByNorm = new Map<string, string>();
  for (const row of existing ?? []) {
    existingByNorm.set(normalizeFact(row.fact), row.id);
  }

  const toInsert: {
    user_id: string;
    fact: string;
    source_chat_id: string;
    confidence: number;
  }[] = [];
  const bumpIds: string[] = [];
  const inserted: string[] = [];

  for (const fact of cleaned) {
    const existingId = existingByNorm.get(normalizeFact(fact));
    if (existingId) {
      bumpIds.push(existingId);
    } else {
      toInsert.push({
        user_id: userId,
        fact,
        source_chat_id: sourceChatId,
        confidence,
      });
      inserted.push(fact);
    }
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase
      .from("agent_memory")
      .insert(toInsert);
    if (insErr) console.error("saveMemoryFacts insert:", insErr.message);
  }
  if (bumpIds.length > 0) {
    const { error: bumpErr } = await supabase
      .from("agent_memory")
      .update({ updated_at: new Date().toISOString() })
      .in("id", bumpIds);
    if (bumpErr) console.error("saveMemoryFacts bump:", bumpErr.message);
  }

  // Cap retained rows (fire-and-forget — never blocks the reply).
  if (toInsert.length > 0) void pruneAgentMemory(userId);

  return inserted;
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
