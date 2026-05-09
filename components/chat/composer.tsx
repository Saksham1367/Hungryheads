"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Paperclip, Send, Users } from "lucide-react";
import type { ChatMode } from "@/types/domain";
import { CHAT_MODES } from "@/lib/chat/modes";
import { cn } from "@/lib/utils/cn";

export function Composer({
  mode,
  onSend,
  disabled,
}: {
  mode: ChatMode;
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const meta = CHAT_MODES[mode];

  // Auto-grow up to 140px (matches prototype max-height).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  const submit = () => {
    const t = draft.trim();
    if (!t || disabled) return;
    onSend(t);
    setDraft("");
  };

  return (
    <div className="px-7 pb-5 pt-3.5 bg-gradient-to-b from-transparent via-hh-cream/70 to-hh-cream relative">
      <div className="max-w-[780px] mx-auto">
        <div
          className={cn(
            "bg-white border border-hh-gray-light rounded-[22px] py-2 pl-4 pr-2 flex flex-col gap-2",
            "shadow-[0_6px_20px_-10px_rgba(0,0,0,0.12)] transition-all",
            "focus-within:border-hh-orange focus-within:shadow-[0_0_0_3px_rgba(255,107,53,0.16)]",
          )}
        >
          <textarea
            ref={ref}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={`Ask anything about food, restaurants, your orders…   try: "reorder my Sunday breakfast"`}
            rows={1}
            disabled={disabled}
            className="w-full resize-none border-none outline-none bg-transparent font-sans text-[14.5px] text-hh-black placeholder:text-hh-gray py-2 leading-[1.5] disabled:opacity-60"
          />
          <div className="flex items-center justify-between px-1 pb-0.5">
            <div className="flex gap-1">
              <ToolButton title="Attach (Phase 3)" disabled>
                <Paperclip className="h-4 w-4" />
              </ToolButton>
              <ToolButton title="Voice (Phase 3)" disabled>
                <Mic className="h-4 w-4" />
              </ToolButton>
              <ToolButton title="Add to huddle" disabled>
                <Users className="h-4 w-4" />
              </ToolButton>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || disabled}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-hh-orange text-white hover:bg-hh-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-[13px] font-semibold transition-colors"
            >
              Send
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-2 px-1.5 flex items-center justify-between text-[11px] text-hh-gray">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
            <b className="text-hh-charcoal">{meta.label} mode</b>
            <span>· {meta.hint}</span>
          </span>
          <span className="hidden sm:inline">
            <Kbd>⏎</Kbd> send · <Kbd>⇧⏎</Kbd> newline
          </span>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  title,
  disabled,
  children,
}: {
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className="h-8 w-8 rounded-lg text-hh-gray hover:text-hh-orange-dark hover:bg-hh-cream disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] px-1.5 py-px bg-white border border-hh-gray-light border-b-2 rounded text-hh-charcoal">
      {children}
    </span>
  );
}
