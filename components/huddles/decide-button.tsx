"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { triggerHuddleDecision } from "@/app/(app)/dashboard/huddle-actions";

export function DecideButton({ huddleId }: { huddleId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    setError(null);
    setPending(true);
    try {
      console.log("[DecideButton] clicked, huddleId=", huddleId);
      const result = await triggerHuddleDecision(huddleId, "order_in");
      console.log("[DecideButton] result:", result);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      // Hard reload — bypasses any router cache or stale server-component data.
      // We keep `pending=true` because the page is about to navigate away.
      window.location.reload();
    } catch (err) {
      console.error("[DecideButton] threw:", err);
      setError(
        err instanceof Error ? err.message : "Couldn't start the decision.",
      );
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-br from-hh-orange to-hh-orange-dark text-white font-display font-extrabold text-lg shadow-lg shadow-hh-orange/30 hover:shadow-xl hover:shadow-hh-orange/40 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:translate-y-0"
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
        {pending ? "Starting…" : "Decide! — Let's eat"}
      </button>
      {error && (
        <p className="text-xs text-hh-danger" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-hh-gray text-center">
        Pings every member to vote. Top 3 picks + spin-the-wheel right after.
      </p>
    </div>
  );
}
