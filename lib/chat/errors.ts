/**
 * Friendly error model for chat failures.
 *
 * Three sources of errors:
 *   1. /api/chat HTTP error response (400/401/415/429/500…)
 *      → mapped via {@link parseHttpErrorBody}
 *   2. SSE `{ type: "error", code, message }` mid-stream
 *      → carries a {@link ChatErrorCode} directly
 *   3. Network throw (fetch failed, AbortError, etc.)
 *      → categorised on the client via {@link categorizeClientError}
 *
 * Both server and client import this module so the catalog stays in one place.
 */

export type ChatErrorCode =
  | "out_of_credits"
  | "rate_limited"
  | "overloaded"
  | "network"
  | "auth"
  | "empty_message"
  | "file_too_large"
  | "unsupported_file"
  | "attachment_parse"
  | "history_corrupted"
  | "profile_missing"
  | "swiggy_reauth"
  | "internal"
  | "unknown";

export interface ChatErrorInfo {
  code: ChatErrorCode;
  /** Short headline shown above the detail (e.g. "We're out of API credits"). */
  title: string;
  /** One- to two-sentence explanation with a suggested next step. */
  detail: string;
  /** True if a "Try again" prompt makes sense for this category. */
  retryable: boolean;
}

const CATALOG: Record<ChatErrorCode, Omit<ChatErrorInfo, "code">> = {
  out_of_credits: {
    title: "Couldn't reach the assistant right now",
    detail:
      "We hit a small hiccup on our end. Please try again in a few minutes — your message is safe.",
    retryable: true,
  },
  rate_limited: {
    title: "Take a quick breath",
    detail:
      "You're sending messages a little too quickly. Wait a few seconds and try again.",
    retryable: true,
  },
  overloaded: {
    title: "Things are a bit busy right now",
    detail:
      "We couldn't process your message in time. Give it a moment and try sending it again.",
    retryable: true,
  },
  network: {
    title: "Connection trouble",
    detail:
      "Looks like a network hiccup. Check your internet and try sending again.",
    retryable: true,
  },
  auth: {
    title: "Your session timed out",
    detail: "Refresh the page and sign in again to continue.",
    retryable: false,
  },
  empty_message: {
    title: "Nothing to send",
    detail: "Type a question or attach a file before hitting send.",
    retryable: false,
  },
  file_too_large: {
    title: "That file is a bit too big",
    detail: "Please pick a file 5 MB or smaller and try again.",
    retryable: false,
  },
  unsupported_file: {
    title: "We can't read that file type",
    detail: "Try a PDF, DOC, DOCX, XLS, XLSX, or CSV instead.",
    retryable: false,
  },
  attachment_parse: {
    title: "Couldn't open that file",
    detail:
      "It might be damaged or password-protected. Try a different file.",
    retryable: false,
  },
  history_corrupted: {
    title: "Something got out of sync",
    detail:
      "Refresh the page and try again. If it keeps happening, start a new chat.",
    retryable: false,
  },
  profile_missing: {
    title: "Profile isn't set up yet",
    detail:
      "Finish onboarding from your profile page so we know your preferences.",
    retryable: false,
  },
  swiggy_reauth: {
    title: "Reconnect your Swiggy account",
    detail:
      "Your Swiggy connection needs a refresh. Reconnect it from the sidebar to keep browsing and ordering — it only takes a second.",
    retryable: false,
  },
  internal: {
    title: "Something went wrong",
    detail:
      "We ran into an unexpected hiccup. Please try again in a moment.",
    retryable: true,
  },
  unknown: {
    title: "Something went wrong",
    detail: "We hit a snag. Please try again in a moment.",
    retryable: true,
  },
};

export function describeChatError(code: ChatErrorCode): ChatErrorInfo {
  return { code, ...CATALOG[code] };
}

/** True for the chat-error codes the catalog knows about. */
export function isChatErrorCode(v: unknown): v is ChatErrorCode {
  return typeof v === "string" && v in CATALOG;
}

/**
 * Server-side: convert any thrown error (usually from the Anthropic SDK)
 * into a {@link ChatErrorCode}. Matches against status code AND message body
 * because the SDK puts the helpful detail in `.message`.
 */
export function categorizeSdkError(err: unknown): ChatErrorCode {
  if (!err) return "internal";

  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const lower = message.toLowerCase();

  // Live Swiggy MCP failures (SwiggyMcpError). Detected structurally by name so
  // this shared client+server module never imports the server-only MCP client.
  if (err instanceof Error && err.name === "SwiggyMcpError") {
    const c = (err as { code?: unknown }).code;
    if (c === "reauth") return "swiggy_reauth";
    if (c === "rate_limited") return "rate_limited";
    if (c === "upstream") return "overloaded";
    return "internal";
  }

  // The most common one right now: Anthropic 400 with credit-balance body.
  if (
    lower.includes("credit balance is too low") ||
    lower.includes("insufficient credit") ||
    lower.includes("billing")
  ) {
    return "out_of_credits";
  }

  // SDK errors expose `.status` as a number.
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === "number") {
      if (status === 429) return "rate_limited";
      if (status === 401 || status === 403) return "auth";
      if (status === 503 || status === 529) return "overloaded";
    }
  }

  // Network-level: fetch failure, DNS, abort-from-disconnect, etc.
  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("enotfound")
  ) {
    return "network";
  }

  return "internal";
}

/**
 * Client-side: figure out a code from a thrown fetch/stream error.
 * Returns null for AbortError so callers can swallow user-initiated cancels.
 */
export function categorizeClientError(err: unknown): ChatErrorCode | null {
  if (isAbortError(err)) return null;

  if (!err) return "unknown";

  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const lower = message.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed")
  ) {
    return "network";
  }

  // Server already sent a coded SSE error event — preserve it.
  if (isChatErrorCode(message)) return message;

  return "unknown";
}

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  if (name === "AbortError") return true;
  const msg = (err as { message?: unknown }).message;
  if (typeof msg === "string" && msg.toLowerCase().includes("abort")) {
    return true;
  }
  return false;
}
