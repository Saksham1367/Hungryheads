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
            title={m.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full text-xs font-semibold transition-all",
              // Compact (dot-only) on mobile, full pill with label on sm+.
              "px-2 py-1.5 sm:px-3.5",
              active
                ? "bg-white text-hh-black shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-hh-charcoal hover:text-hh-black",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", m.dotClass)} />
            {/* Active mode always shows its label; inactive labels appear on
                sm+ so the picker stays compact on mobile without becoming three
                indistinguishable dots. */}
            <span className={cn(active ? "inline" : "hidden sm:inline")}>
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
