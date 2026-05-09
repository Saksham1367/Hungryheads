"use client";

import { useState } from "react";
import { Check, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { placeHuddleOrderFromWinner } from "@/app/(app)/dashboard/huddle-actions";
import type { HuddleRecommendationView } from "@/lib/huddles/queries";

export function WinnerCard({
  sessionId,
  winner,
  alreadyOrdered,
  canOrder,
}: {
  sessionId: string;
  winner: HuddleRecommendationView;
  alreadyOrdered: boolean;
  /** Only the triggerer can place the group order. */
  canOrder: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(alreadyOrdered);

  const onPlace = async () => {
    setError(null);
    setPending(true);
    try {
      console.log("[PlaceHuddleOrder] sessionId=", sessionId);
      const result = await placeHuddleOrderFromWinner(sessionId);
      console.log("[PlaceHuddleOrder] result:", result);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      setPlaced(true);
      window.location.reload();
    } catch (err) {
      console.error("[PlaceHuddleOrder] threw:", err);
      setError(err instanceof Error ? err.message : "Couldn't place order.");
      setPending(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-hh-orange bg-gradient-to-br from-hh-orange-light/40 via-white to-white p-6 space-y-4 shadow-lg">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-hh-orange text-white shrink-0">
          <Trophy className="h-5 w-5" />
        </span>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-hh-orange-dark">
            Winner
          </span>
          <h2 className="font-display text-xl md:text-2xl font-extrabold text-hh-black leading-tight">
            {winner.name}
          </h2>
        </div>
      </div>

      {winner.cuisines.length > 0 && (
        <div className="text-sm text-hh-charcoal">
          {winner.cuisines.slice(0, 4).join(" · ")}
          {winner.rating != null &&
            winner.distance_km != null &&
            ` · ★${winner.rating.toFixed(1)} · ${winner.distance_km}km`}
        </div>
      )}

      {winner.reasoning && (
        <p className="text-sm italic text-hh-charcoal bg-white rounded-xl border border-hh-gray-light px-3.5 py-2.5">
          {winner.reasoning}
        </p>
      )}

      {placed ? (
        <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-emerald-50 border border-hh-success/40 text-hh-success font-semibold text-sm">
          <Check className="h-4 w-4" />
          Group order placed · COD
        </div>
      ) : canOrder ? (
        <>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onPlace}
            disabled={pending}
            className="w-full"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {pending ? "Placing…" : `Order from ${winner.name.split(" — ")[0]}`}
          </Button>
          <p className="text-[11px] text-hh-gray text-center">
            Phase-1 records the group order in the huddle&apos;s history. Step
            12 wires the live Swiggy MCP cart + COD checkout.
          </p>
        </>
      ) : (
        <div className="rounded-xl border border-hh-gray-light bg-hh-cream/60 px-4 py-3 text-sm text-hh-charcoal text-center italic">
          Waiting for whoever started the huddle to place the group order.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-hh-danger/40 bg-red-50 px-3 py-2 text-sm text-hh-danger"
        >
          {error}
        </div>
      )}
    </div>
  );
}
