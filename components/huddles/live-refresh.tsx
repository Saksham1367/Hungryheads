"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Supabase Realtime for the given huddle + (optional) session and
 * triggers `router.refresh()` whenever a teammate votes, the triggerer Decides,
 * or a winner is set. Server stays the source of truth — this is just a nudge.
 *
 * Refreshes are debounced (250ms) so a flurry of inserts coalesces into one
 * round-trip.
 */
export function HuddleLiveRefresh({
  huddleId,
  sessionId,
}: {
  huddleId: string;
  sessionId?: string;
}) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const queue = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase.channel(`huddle:${huddleId}`);

    // New session created on this huddle (or status flips to ordered/cancelled)
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "huddle_sessions",
        filter: `huddle_id=eq.${huddleId}`,
      },
      queue,
    );

    if (sessionId) {
      // Vote landed
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "huddle_responses",
          filter: `huddle_session_id=eq.${sessionId}`,
        },
        queue,
      );

      // Top-3 recommendations generated after Decide
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "huddle_recommendations",
          filter: `huddle_session_id=eq.${sessionId}`,
        },
        queue,
      );
    }

    channel.subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [huddleId, sessionId, router]);

  return null;
}
