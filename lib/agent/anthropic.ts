/**
 * Anthropic client singleton — server-only.
 *
 * Phase-1 default model: Sonnet 4.6 (good balance of reasoning, latency, cost).
 * Override with ANTHROPIC_MODEL env var if needed. Opus 4.7 for complex group
 * decisions in Step 10.
 */
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function anthropicClient(): Anthropic {
  if (typeof window !== "undefined") {
    throw new Error("anthropicClient() called from the browser — server-only.");
  }
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local from console.anthropic.com.",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export const DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

/**
 * Max output tokens per chat reply.
 *
 * Was 1024 — too low. A pitch + the trailing <order-summary> JSON could exceed
 * it, truncating the response mid-JSON so the order card failed to parse ("works
 * one time, fails the next"). 4096 comfortably fits a multi-paragraph reply plus
 * the card with headroom, and Sonnet 4.6 supports far more.
 */
export const DEFAULT_MAX_TOKENS = 4096;
