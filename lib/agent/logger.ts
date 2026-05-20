/**
 * Structured tool-call logger.
 *
 * Matches the shape Swiggy Builders Club docs §8 recommends — `ts`, `event`,
 * `tool`, `user_id_hash`, `duration_ms`, `status`. The session id field (the
 * MCP session, not Supabase) is populated by the live MCP client in Step 12;
 * mock dispatch only carries a hashed user id.
 *
 * Output goes to stdout (`console.info` with the `mcp_tool_call` event tag)
 * so Vercel / Render log streams can pick it up. Swap for a real logger
 * (pino/winston) when we wire production observability.
 */
import { createHash } from "node:crypto";

export interface ToolCallLog {
  tool: string;
  ok: boolean;
  duration_ms: number;
  user_id_hash?: string;
  session_id?: string;
  error?: string;
}

/**
 * SHA-256 of the user id, namespaced so the same Supabase user across
 * environments doesn't collide. Docs §8 + §15: "Hash user IDs at rest unless
 * you have a specific DPDP-compliant reason to store them plaintext."
 */
export function hashUserId(userId: string): string {
  return (
    "sha256:" +
    createHash("sha256").update(`hungryheads:${userId}`).digest("hex").slice(0, 16)
  );
}

export function logToolCall(log: ToolCallLog): void {
  // One JSON line per call. Cheap to grep, parses cleanly in log aggregators.
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: log.ok ? "info" : "warn",
      event: "mcp_tool_call",
      ...log,
    }),
  );
}

/**
 * Sniff response `_meta` for the v1.1 deprecation contract (docs §9.5).
 * Not emitted in v1.0 — Swiggy will populate it once v1.1 ships.
 *
 *   _meta: { "swiggy.deprecation": { tool, replaced_by, remove_after } }
 *
 * Wire this around every live MCP response so we get an automatic warning
 * the moment Swiggy starts emitting it; no rollout needed on our side.
 */
export interface DeprecationWarning {
  tool: string;
  replaced_by?: string;
  remove_after?: string;
}

export function checkDeprecation(
  toolName: string,
  response: unknown,
): DeprecationWarning | null {
  if (!response || typeof response !== "object") return null;
  const meta = (response as { _meta?: Record<string, unknown> })._meta;
  if (!meta) return null;
  const dep = meta["swiggy.deprecation"] as
    | { tool?: string; replaced_by?: string; remove_after?: string }
    | undefined;
  if (!dep) return null;
  const warning: DeprecationWarning = {
    tool: dep.tool ?? toolName,
    replaced_by: dep.replaced_by,
    remove_after: dep.remove_after,
  };
  console.warn(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "warn",
      event: "mcp_deprecation",
      ...warning,
    }),
  );
  return warning;
}
