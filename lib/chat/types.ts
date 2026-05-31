/**
 * Chat view-model types.
 *
 * The DB row shapes (in `types/database.ts`) are intentionally close to the
 * Postgres schema. These view-model types are what the UI consumes — derived
 * once on the server and passed down to client components. Keeps `chat/*`
 * components free of Supabase imports.
 */
import type { ChatErrorInfo } from "@/lib/chat/errors";
import type {
  ChatMessagePayload,
  ChatMode,
  HuddleSessionStatus,
  OrderSummaryPayload,
} from "@/types/domain";

export interface ChatView {
  id: string;
  title: string;
  mode: ChatMode;
  last_message_at: string;
}

export interface ChatAttachmentMeta {
  filename: string;
  mime_type: string;
  size_bytes: number;
}

/**
 * A tool the agent ran while producing a message. Persisted to
 * `chat_messages.tool_calls` and rendered as permanent activity chips
 * ("Searched restaurants", "Read the menu") inside the agent bubble.
 */
export interface ToolCallRecord {
  name: string;
  ok: boolean;
}

export interface ChatMessageView {
  id: string;
  role: "user" | "agent";
  text: string;
  mode_at_send: ChatMode;
  /** Decoded inline order card payload, if present. */
  order?: OrderSummaryPayload;
  /** Decoded "Learned: ..." pill text, if present. */
  learned?: string;
  /**
   * Transient — set when the agent updated the user's SafePlate allergy list
   * this turn (via update_allergy). Renders a "SafePlate updated" shield pill.
   * Not persisted; only shown live on the optimistic message.
   */
  safeplateNote?: string;
  /** Raw payload — kept around so future card types render cleanly. */
  payload?: ChatMessagePayload;
  /** File attached to the user's message (rendered as a pill in the bubble). */
  attachment?: ChatAttachmentMeta;
  /**
   * Transient — set when an agent turn failed (network / out-of-credits /
   * overloaded / etc). Renders as an inline error card inside the agent
   * bubble. Never persisted to DB; only present on the optimistic message
   * while the failed turn is still on screen.
   */
  error?: ChatErrorInfo;
  /**
   * Permanent record of tools the agent ran for this message. Persisted to
   * `chat_messages.tool_calls`; rendered as static "Searched restaurants"
   * chips that survive reloads. Distinct from `tool` below (the live, animated
   * in-progress indicator).
   */
  toolCalls?: ToolCallRecord[];
  created_at: string;
  /**
   * Transient UI-only — name of the tool the agent is currently invoking.
   * Set during the streaming gap between `tool_start` and `tool_end`. Never
   * persisted to DB. Drives the animated "Searching restaurants…" indicator;
   * once the tool finishes it graduates into a permanent `toolCalls` chip.
   */
  tool?: string | null;
}

export interface HuddleView {
  id: string;
  code: string;
  name: string;
  member_count: number;
  /** True when an open `huddle_sessions` row is in 'polling' state. */
  poll_live: boolean;
  /** Sidebar avatar — 2-letter initials. */
  initials: string;
  /** Sidebar avatar gradient variant — deterministic per huddle id. */
  variant: "g1" | "g2" | "g3";
  /** "4 members · poll live" or "3 members · 2h ago" sub-label. */
  sub: string;
  /** Active session, if any (used by Step 9 to drive the polling banner). */
  active_session?: {
    id: string;
    status: HuddleSessionStatus;
    created_at: string;
  };
}
