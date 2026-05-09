"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  pickHuddleWinner,
  spinHuddleWheel,
} from "@/app/(app)/dashboard/huddle-actions";
import type { HuddleRecommendationView } from "@/lib/huddles/queries";
import { SpinWheel } from "@/components/huddles/spin-wheel";
import { cn } from "@/lib/utils/cn";

export function TopThree({
  sessionId,
  recommendations,
  canSpin,
}: {
  sessionId: string;
  recommendations: HuddleRecommendationView[];
  /** Only the triggerer can spin the wheel. Others see "waiting" copy. */
  canSpin: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winnerRank, setWinnerRank] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);

  const onSpin = async () => {
    if (recommendations.length === 0) return;
    setError(null);
    setSpinning(true);
    setPending(true);
    try {
      console.log("[Spin] clicked, sessionId=", sessionId);
      const result = await spinHuddleWheel(sessionId);
      console.log("[Spin] result:", result);
      if (!result.ok) {
        setSpinning(false);
        setError(result.error);
        setPending(false);
        return;
      }
      setWinnerRank(result.rank);
      // Wheel animation duration = 3.5s — hard reload after to swap to the
      // winner card cleanly.
      window.setTimeout(() => {
        window.location.reload();
      }, 3700);
    } catch (err) {
      console.error("[Spin] threw:", err);
      setSpinning(false);
      setError(err instanceof Error ? err.message : "Spin failed.");
      setPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-bold text-hh-black flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-hh-orange-dark" />
          Top {recommendations.length} pick
          {recommendations.length === 1 ? "" : "s"}
        </h2>
        <p className="text-sm text-hh-charcoal">
          Allergies + diet respected. Now decide together — or let the wheel.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recommendations.map((r) => (
          <RecCard
            key={r.id}
            rec={r}
            highlighted={winnerRank === r.rank}
            sessionId={sessionId}
            canPick={canSpin}
            onPicked={(rank) => {
              setWinnerRank(rank);
              // Hard reload after a brief delay so the winner card replaces
              // the top-3 view cleanly.
              window.setTimeout(() => window.location.reload(), 600);
            }}
          />
        ))}
      </div>

      {canSpin ? (
        <>
          {recommendations.length > 1 && (
            <SpinWheel
              recommendations={recommendations}
              spinning={spinning}
              winnerRank={winnerRank}
            />
          )}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={onSpin}
              disabled={pending || spinning}
              className="w-full"
            >
              {pending || spinning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trophy className="h-4 w-4" />
              )}
              {spinning ? "Spinning…" : "🎲 Spin the wheel"}
            </Button>
            <p className="text-[11px] text-hh-gray text-center">
              Or hit <span className="font-semibold">Pick this</span> on any
              card above to choose directly.
            </p>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-hh-gray-light bg-hh-cream/60 px-4 py-3 text-sm text-hh-charcoal text-center italic">
          Waiting for whoever started the huddle to pick the winner — by spin
          or by tapping a card.
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

function RecCard({
  rec,
  highlighted,
  sessionId,
  canPick,
  onPicked,
}: {
  rec: HuddleRecommendationView;
  highlighted: boolean;
  sessionId: string;
  canPick: boolean;
  onPicked: (rank: number) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const onPick = async () => {
    if (picking || picked) return;
    setPickError(null);
    setPicking(true);
    try {
      console.log("[Pick] sessionId=", sessionId, "rec=", rec.id);
      const result = await pickHuddleWinner(sessionId, rec.id);
      console.log("[Pick] result:", result);
      if (!result.ok) {
        setPickError(result.error);
        setPicking(false);
        return;
      }
      setPicked(true);
      onPicked(rec.rank);
    } catch (err) {
      console.error("[Pick] threw:", err);
      setPickError(err instanceof Error ? err.message : "Pick failed.");
      setPicking(false);
    }
  };

  // Gradient header per rank — gold/silver/bronze-ish vibe.
  const headerGradient =
    rec.rank === 1
      ? "from-hh-orange to-hh-orange-dark"
      : rec.rank === 2
        ? "from-blue-500 to-blue-700"
        : "from-emerald-500 to-emerald-700";

  return (
    <div
      className={cn(
        "group rounded-2xl border bg-white overflow-hidden transition-all flex flex-col",
        highlighted || picked
          ? "border-hh-orange ring-2 ring-hh-orange/30 shadow-lg"
          : "border-hh-gray-light shadow-sm hover:-translate-y-0.5 hover:shadow-lg",
      )}
    >
      {/* Image-like header (no real image — gradient + cuisine emoji) */}
      <div
        className={cn(
          "relative h-24 bg-gradient-to-br flex items-center justify-center",
          headerGradient,
        )}
      >
        <span
          aria-hidden
          className="text-5xl drop-shadow-sm select-none opacity-90"
        >
          {cuisineEmoji(rec.cuisines)}
        </span>
        {/* Big rank badge */}
        <span
          className={cn(
            "absolute top-3 left-3 inline-flex items-center justify-center font-display font-extrabold rounded-full bg-white shadow-md",
            rec.rank === 1
              ? "h-10 w-10 text-base text-hh-orange-dark ring-2 ring-hh-orange"
              : "h-9 w-9 text-sm text-hh-charcoal",
          )}
        >
          {rec.rank === 1 ? <Trophy className="h-4 w-4" /> : `#${rec.rank}`}
        </span>
        {/* Rating badge top-right */}
        {rec.rating != null && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 text-[11px] font-bold text-hh-black tabular shadow-sm">
            <Star className="h-3 w-3 fill-amber-400 stroke-amber-400" />
            {rec.rating.toFixed(1)}
          </span>
        )}
      </div>

      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <h3 className="font-display font-extrabold text-hh-black text-base leading-tight line-clamp-2">
          {rec.name}
        </h3>
        {rec.cuisines.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {rec.cuisines.slice(0, 3).map((c) => (
              <span
                key={c}
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-hh-orange-light text-hh-orange-dark"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        {rec.distance_km != null && (
          <div className="text-[11px] text-hh-gray tabular">
            {rec.distance_km.toFixed(1)} km away
          </div>
        )}
        {rec.reasoning && (
          <p className="text-[13px] text-hh-charcoal italic leading-relaxed pt-1.5 border-t border-hh-gray-light/70 mt-2">
            {rec.reasoning}
          </p>
        )}

        {canPick && (
          <div className="pt-2 mt-auto space-y-1">
            <button
              type="button"
              onClick={onPick}
              disabled={picking || picked}
              className={cn(
                "w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                picked
                  ? "bg-emerald-50 text-hh-success border border-hh-success/40"
                  : "bg-white border border-hh-orange text-hh-orange-dark hover:bg-hh-orange-light disabled:opacity-60 disabled:cursor-not-allowed",
              )}
            >
              {picking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : picked ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {picked ? "Picked" : picking ? "Picking…" : "Pick this"}
            </button>
            {pickError && (
              <p
                className="text-[11px] text-hh-danger text-center"
                role="alert"
              >
                {pickError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Pick a representative emoji for the dominant cuisine. Phase-1 polish. */
function cuisineEmoji(cuisines: string[]): string {
  const c = (cuisines[0] ?? "").toLowerCase();
  if (c.includes("biryani") || c.includes("hyderabadi")) return "🍚";
  if (c.includes("burger") || c.includes("american")) return "🍔";
  if (c.includes("pizza") || c.includes("italian")) return "🍕";
  if (c.includes("south indian")) return "🥞";
  if (c.includes("north indian") || c.includes("mughlai")) return "🍛";
  if (c.includes("chinese") || c.includes("asian") || c.includes("thai"))
    return "🥡";
  if (c.includes("healthy") || c.includes("salad") || c.includes("bowl"))
    return "🥗";
  if (c.includes("dessert") || c.includes("cafe")) return "🧁";
  return "🍽️";
}
