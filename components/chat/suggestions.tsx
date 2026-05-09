"use client";

import type { ChatMode } from "@/types/domain";
import { CHAT_MODES } from "@/lib/chat/modes";

export function ChatSuggestions({
  mode,
  onPick,
}: {
  mode: ChatMode;
  onPick: (text: string) => void;
}) {
  const meta = CHAT_MODES[mode];
  return (
    <div className="px-7">
      <div className="max-w-[780px] mx-auto flex flex-wrap gap-2">
        {meta.suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s.replace(/^[^\s]+\s/, ""))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-hh-gray-light text-xs text-hh-charcoal hover:border-hh-orange hover:bg-hh-orange-light hover:text-hh-orange-dark transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
