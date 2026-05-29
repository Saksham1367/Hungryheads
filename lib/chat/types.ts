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

export interface ChatMessageView {
  id: string;
  role: "user" | "agent";
  text: string;
  mode_at_send: ChatMode;
  /** Decoded inline order card payload, if present. */
  order?: OrderSummaryPayload;
  /** Decoded "Learned: ..." pill text, if present. */
  learned?: string;
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
  created_at: string;
  /**
   * Transient UI-only — name of the tool the agent is currently invoking.
   * Set during the streaming gap between `tool_start` and the next text
   * delta. Never persisted to DB. Drives the inline "Searching restaurants…"
   * indicator inside the agent bubble.
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
