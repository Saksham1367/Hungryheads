/**
 * Live Swiggy Builders Club "Food" MCP client (Step 12).
 *
 * Thin wrapper over the MCP TypeScript SDK that:
 *   - connects to the Food server over streamable HTTP with OUR Bearer token
 *     (we manage the token ourselves — no SDK OAuth authProvider flow),
 *   - calls a tool and unwraps the Swiggy `{ success, data }` envelope,
 *   - classifies failures (esp. 401 → the user must reconnect Swiggy),
 *   - sniffs the v1.1 deprecation `_meta` contract.
 *
 * Server-only. Used exclusively by the live dispatch path (MCP_MODE=live);
 * mock mode never touches this. Token lifecycle (5-day, no refresh per spec)
 * is handled by the caller: on a `reauth` error, route the user back through
 * /connect-swiggy.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { checkDeprecation } from "@/lib/agent/logger";
import { getSwiggyToken } from "@/lib/swiggy/tokens";

/** Food MCP endpoint (env-overridable for staging). Spec §4. */
export const SWIGGY_FOOD_MCP_URL =
  process.env.SWIGGY_MCP_FOOD_URL ?? "https://mcp.swiggy.com/food";

export type SwiggyMcpErrorCode =
  | "reauth" // 401/419 — token expired/revoked; user must reconnect Swiggy
  | "rate_limited" // 429
  | "upstream" // 5xx — Swiggy/underlying issue, retryable
  | "validation" // 400 — bad params
  | "not_found" // 404
  | "tool_error" // the tool returned { success: false } / isError
  | "unknown";

export class SwiggyMcpError extends Error {
  readonly code: SwiggyMcpErrorCode;
  readonly status?: number;
  readonly retryable: boolean;
  readonly reportLink?: string;

  constructor(
    code: SwiggyMcpErrorCode,
    message: string,
    opts?: { status?: number; retryable?: boolean; reportLink?: string },
  ) {
    super(message);
    this.name = "SwiggyMcpError";
    this.code = code;
    this.status = opts?.status;
    this.retryable = opts?.retryable ?? false;
    this.reportLink = opts?.reportLink;
  }

  /** True when the user needs to reconnect their Swiggy account. */
  get needsReauth(): boolean {
    return this.code === "reauth";
  }
}

/** Map a thrown transport/SDK error into a typed SwiggyMcpError. */
function classifyThrown(err: unknown): SwiggyMcpError {
  if (err instanceof SwiggyMcpError) return err;
  if (err instanceof UnauthorizedError) {
    return new SwiggyMcpError("reauth", "Swiggy session expired — reconnect.", {
      status: 401,
    });
  }
  if (err instanceof StreamableHTTPError) {
    const status = err.code;
    if (status === 401 || status === 419) {
      return new SwiggyMcpError(
        "reauth",
        "Swiggy session expired — reconnect.",
        { status },
      );
    }
    if (status === 429) {
      return new SwiggyMcpError("rate_limited", "Swiggy is busy — try again.", {
        status,
        retryable: true,
      });
    }
    if (typeof status === "number" && status >= 500) {
      return new SwiggyMcpError("upstream", "Swiggy is having trouble.", {
        status,
        retryable: true,
      });
    }
    if (status === 404) {
      return new SwiggyMcpError("not_found", err.message || "Not found.", {
        status,
      });
    }
    if (status === 400) {
      return new SwiggyMcpError("validation", err.message || "Invalid request.", {
        status,
      });
    }
    return new SwiggyMcpError("unknown", err.message || "Swiggy call failed.", {
      status,
    });
  }
  return new SwiggyMcpError(
    "unknown",
    err instanceof Error ? err.message : "Swiggy call failed.",
  );
}

/**
 * Minimal shape we read off an MCP tool result. The SDK's own return type is
 * generic/overloaded (collapses `content` to `unknown`), so we cast to this.
 */
interface McpToolResult {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: unknown;
}

/**
 * Pull the JSON payload out of an MCP tool result: prefer `structuredContent`,
 * otherwise parse the first text block as JSON (fall back to the raw text).
 */
function extractPayload(result: McpToolResult): unknown {
  const structured = result.structuredContent;
  if (structured && typeof structured === "object") return structured;

  const textBlock = result.content?.find((b) => b.type === "text");
  if (textBlock && typeof textBlock.text === "string") {
    try {
      return JSON.parse(textBlock.text);
    } catch {
      return textBlock.text; // non-JSON text — hand back as-is
    }
  }
  return undefined;
}

/** Unwrap Swiggy's `{ success, data }` envelope; throw on `{ success: false }`. */
function unwrapEnvelope(payload: unknown, toolName: string): unknown {
  if (payload && typeof payload === "object" && "success" in payload) {
    const env = payload as {
      success: boolean;
      data?: unknown;
      message?: string;
      error?: { message?: string; reportLink?: string; reportHint?: string };
    };
    if (env.success) return env.data ?? null;
    throw new SwiggyMcpError(
      "tool_error",
      env.error?.message ?? env.message ?? `${toolName} failed`,
      { reportLink: env.error?.reportLink },
    );
  }
  // No envelope — return as-is (defensive; the spec says every tool wraps).
  return payload;
}

/**
 * A per-request session to the Swiggy Food MCP server. Connect lazily on the
 * first call, reuse across the whole tool loop, then `close()` when done.
 */
export class SwiggyMcpSession {
  private readonly client: Client;
  private readonly transport: StreamableHTTPClientTransport;
  private connected = false;

  constructor(bearerToken: string) {
    this.transport = new StreamableHTTPClientTransport(
      new URL(SWIGGY_FOOD_MCP_URL),
      { requestInit: { headers: { Authorization: `Bearer ${bearerToken}` } } },
    );
    this.client = new Client(
      { name: "hungryheads", version: "1.0.0" },
      { capabilities: {} },
    );
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;
    try {
      await this.client.connect(this.transport);
      this.connected = true;
    } catch (err) {
      throw classifyThrown(err);
    }
  }

  /** Call a Food tool by name. Returns the unwrapped `data`. Throws SwiggyMcpError. */
  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    await this.ensureConnected();

    let raw: unknown;
    try {
      raw = await this.client.callTool({ name, arguments: args });
    } catch (err) {
      throw classifyThrown(err);
    }

    // Auto-warn if Swiggy starts flagging this tool as deprecated (v1.1 _meta).
    checkDeprecation(name, raw);

    const result = raw as McpToolResult;
    const payload = extractPayload(result);

    if (result.isError) {
      // Standard failure envelope? unwrap throws a typed SwiggyMcpError.
      if (payload && typeof payload === "object" && "success" in payload) {
        unwrapEnvelope(payload, name);
      }
      const msg =
        typeof payload === "string" ? payload : `${name} failed`;
      throw new SwiggyMcpError("tool_error", msg);
    }

    return unwrapEnvelope(payload, name);
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.transport.close();
    } catch {
      /* best-effort — the session is being torn down anyway */
    }
    this.connected = false;
  }
}

/**
 * Open a session for a user. Throws a `reauth` SwiggyMcpError when the user has
 * no valid Swiggy token, so the caller can route them to /connect-swiggy.
 */
export async function openSwiggyMcpSession(
  userId: string,
): Promise<SwiggyMcpSession> {
  const token = await getSwiggyToken(userId);
  if (!token) {
    throw new SwiggyMcpError("reauth", "No Swiggy connection — reconnect.", {
      status: 401,
    });
  }
  return new SwiggyMcpSession(token.access_token);
}
