"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CHAT_MODES, CHAT_MODE_LIST } from "@/lib/chat/modes";
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
    <>
      {/* Mobile: compact dropdown. */}
      <div className="sm:hidden">
        <ModeDropdown value={value} onChange={onChange} />
      </div>
      {/* Tablet / desktop: segmented pill tablist (unchanged). */}
      <div className="hidden sm:block">
        <ModeTabs value={value} onChange={onChange} />
      </div>
    </>
  );
}

// ─── Mobile dropdown ─────────────────────────────────────────────────────────
function ModeDropdown({
  value,
  onChange,
}: {
  value: ChatMode;
  onChange: (m: ChatMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = CHAT_MODES[value];

  // Click outside + Escape to close.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Chat mode: ${active.label}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-hh-cream border border-hh-gray-light px-3 py-1.5 text-xs font-semibold text-hh-black"
      >
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", active.dotClass)} />
        {active.label}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-hh-gray transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Chat mode"
          className="absolute right-0 top-full mt-1.5 z-30 min-w-[160px] rounded-xl bg-white border border-hh-gray-light shadow-lg overflow-hidden animate-fade-in"
        >
          {CHAT_MODE_LIST.map((m) => {
            const selected = value === m.id;
            return (
              <li key={m.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                    selected
                      ? "bg-hh-cream text-hh-black"
                      : "text-hh-charcoal hover:bg-hh-cream",
                  )}
                >
                  <span
                    className={cn("h-2 w-2 rounded-full shrink-0", m.dotClass)}
                  />
                  <span className="flex-1">{m.label}</span>
                  {selected && (
                    <Check className="h-3.5 w-3.5 text-hh-orange-dark shrink-0" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Tablet / desktop segmented tabs ─────────────────────────────────────────
function ModeTabs({
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
