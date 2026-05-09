"use client";

import { CHAT_MODE_LIST } from "@/lib/chat/modes";
import type { ChatMode } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

export function ModePicker({
  value,
  onChange,
}: {
  value: ChatMode;
  onChange: (m: ChatMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Chat mode"
      className="inline-flex p-1 bg-hh-cream border border-hh-gray-light rounded-full gap-0.5"
    >
      {CHAT_MODE_LIST.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(m.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
              active
                ? "bg-white text-hh-black shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-hh-charcoal hover:text-hh-black",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", m.dotClass)} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
