"use client";

import { useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelHuddleSession,
  decideHuddleSession,
} from "@/app/(app)/dashboard/huddle-actions";

export function DecideNowControls({
  sessionId,
  responseCount,
  memberCount,
  canDecide,
}: {
  sessionId: string;
  responseCount: number;
  memberCount: number;
  /** True if viewer is the triggerer or admin (per RLS, only they can update). */
  canDecide: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDecide = async () => {
    setError(null);
    setPending(true);
    try {
      const result = await decideHuddleSession(sessionId);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      // Hard reload — bypasses any router cache.
      window.location.reload();
    } catch (err) {
      console.error("[DecideNow] threw:", err);
      setError(err instanceof Error ? err.message : "Couldn't decide.");
      setPending(false);
    }
  };

  const onCancel = async () => {
    setError(null);
    setPending(true);
    try {
      await cancelHuddleSession(sessionId);
      window.location.reload();
    } catch (err) {
      console.error("[DecideNow] cancel threw:", err);
      setPending(false);
    }
  };

  if (!canDecide) {
    return (
      <p className="text-xs text-hh-gray italic">
        Waiting for whoever started this huddle to close the poll once enough
        members have voted.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onDecide}
          disabled={pending || responseCount === 0}
          className="flex-1"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Decide now
          <span className="text-[11px] opacity-80 font-normal">
            ({responseCount}/{memberCount} in)
          </span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onCancel}
          disabled={pending}
        >
          <X className="h-4 w-4" />
          Cancel poll
        </Button>
      </div>
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
