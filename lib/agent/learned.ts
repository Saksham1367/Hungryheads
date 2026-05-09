/**
 * Parser for the agent-emitted `LEARNED: <fact>` lines.
 *
 * The system prompt asks Claude to end replies with a single line
 *
 *   LEARNED: <one short sentence>
 *
 * when it commits a stable user preference. The parser strips those lines
 * from the saved content and returns the extracted facts. We persist them
 * to `agent_memory` (so they loop back into future system prompts) and to
 * `chat_messages.learned_fact` (so the "Learned:" pill renders next to that
 * turn).
 */

const LEARNED_LINE_RE = /^[ \t]*LEARNED:[ \t]*(.+?)[ \t]*$/gim;

export interface ParsedLearned {
  /** Reply text with all LEARNED lines removed. */
  cleanedContent: string;
  /** All extracted facts (most-recent message order). */
  facts: string[];
}

export function extractLearnedFacts(text: string): ParsedLearned {
  const facts: string[] = [];
  let cleaned = text;

  // Iterate matches first so we can collect, then strip.
  const matches = Array.from(text.matchAll(LEARNED_LINE_RE));
  for (const m of matches) {
    const fact = m[1].trim();
    // Sanity: cap length, dedupe, ignore empties.
    if (!fact || fact.length > 240) continue;
    if (facts.includes(fact)) continue;
    facts.push(fact);
  }

  // Remove every LEARNED line from the body.
  cleaned = cleaned.replace(LEARNED_LINE_RE, "").trimEnd();
  // Collapse the blank line that often gets left behind.
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return { cleanedContent: cleaned, facts };
}
