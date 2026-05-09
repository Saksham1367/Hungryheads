"use client";

import {
  ChevronsLeft,
  LayoutGrid,
  LogOut,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { LogoMark } from "@/components/ui/logo";
import { CHAT_MODES } from "@/lib/chat/modes";
import { bucketChatsByDay, relativeTime } from "@/lib/chat/util";
import type { ChatView, HuddleView } from "@/lib/chat/types";
import { cn } from "@/lib/utils/cn";

interface ChatSidebarProps {
  userInitial: string;
  userFullName: string;
  chats: ChatView[];
  huddles: HuddleView[];
  activeChatId?: string;
  /** % of monthly budget consumed — shown as Overview badge. */
  budgetUsedPct?: number | null;
  onNewChat: () => void;
  onOpenOverview: () => void;
  onSelectChat: (id: string) => void;
  onOpenHuddle: (code: string) => void;
  onCreateHuddle: () => void;
  onJoinHuddle: () => void;
  onCollapse?: () => void;
  onOpenSettings?: () => void;
}

export function ChatSidebar(props: ChatSidebarProps) {
  const grouped = bucketChatsByDay(props.chats);

  return (
    <aside className="flex flex-col min-h-0 h-full bg-white border-r border-hh-gray-light">
      {/* Brand header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-hh-gray-light shrink-0">
        <span className="inline-flex items-center gap-2 select-none">
          <LogoMark className="h-7 w-7" />
          <span className="font-display font-extrabold text-[17px] tracking-tight text-hh-black">
            Hungry<span className="text-hh-orange">Heads</span>
          </span>
        </span>
        {props.onCollapse && (
          <button
            type="button"
            onClick={props.onCollapse}
            aria-label="Collapse sidebar"
            className="p-1.5 text-hh-gray hover:text-hh-charcoal rounded-md hover:bg-hh-cream"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* + New chat */}
      <button
        type="button"
        onClick={props.onNewChat}
        className="mx-3 mt-3 mb-1 inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-hh-orange hover:bg-hh-orange-dark text-white font-semibold text-sm shadow-md shadow-hh-orange/30 transition-colors"
      >
        <Plus className="h-4 w-4" />
        New chat
      </button>

      {/* Scrollable area */}
      <div className="flex-1 overflow-y-auto px-2 pt-1 pb-4 min-h-0">
        {/* Overview row */}
        <div className="mt-2">
          <button
            type="button"
            onClick={props.onOpenOverview}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-hh-charcoal hover:bg-hh-cream transition-colors text-sm font-medium"
          >
            <LayoutGrid className="h-[18px] w-[18px] opacity-80 shrink-0" />
            <span>Overview</span>
            {typeof props.budgetUsedPct === "number" && (
              <span className="ml-auto text-[10px] font-bold tabular px-2 py-0.5 rounded-full bg-hh-orange-light text-hh-orange-dark">
                {props.budgetUsedPct}%
              </span>
            )}
          </button>
        </div>

        {/* Huddles */}
        <div className="mt-3">
          <SectionHeader
            label="Huddles"
            actionLabel="New"
            onAction={props.onCreateHuddle}
          />
          <div className="space-y-0.5">
            {props.huddles.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => props.onOpenHuddle(h.code)}
                className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-hh-cream transition-colors text-left"
              >
                <span
                  className={cn(
                    "h-[26px] w-[26px] rounded-lg flex items-center justify-center text-white text-[11px] font-bold font-display shrink-0",
                    h.variant === "g1" && "bg-gradient-to-br from-hh-orange to-hh-orange-dark",
                    h.variant === "g2" && "bg-gradient-to-br from-blue-500 to-blue-700",
                    h.variant === "g3" && "bg-gradient-to-br from-emerald-500 to-emerald-700",
                  )}
                >
                  {h.initials}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-hh-charcoal leading-tight truncate">
                    {h.name}
                  </div>
                  <div className="text-[10px] text-hh-gray mt-0.5">
                    {h.sub}
                  </div>
                </div>
                {h.poll_live && (
                  <span
                    aria-label="Poll live"
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-hh-success ring-2 ring-hh-success/20 shrink-0"
                  />
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={props.onJoinHuddle}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-hh-gray hover:bg-hh-cream hover:text-hh-orange-dark text-xs font-medium transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              Join with code
            </button>
          </div>
        </div>

        {/* Recent chats */}
        <div className="mt-3">
          <SectionHeader label="Recent chats" countBadge={props.chats.length} />
          {grouped.map((g) => (
            <div key={g.bucket} className="mt-1">
              <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-semibold text-hh-gray">
                {g.bucket}
              </div>
              {g.chats.map((c) => {
                const mode = CHAT_MODES[c.mode];
                const active = c.id === props.activeChatId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => props.onSelectChat(c.id)}
                    className={cn(
                      "w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-colors",
                      active
                        ? "bg-hh-cream border-l-2 border-hh-orange pl-2"
                        : "hover:bg-hh-cream",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 mt-0.5 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider rounded",
                        mode.tagClass,
                      )}
                    >
                      {mode.short}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-hh-charcoal leading-snug truncate">
                        {c.title}
                      </div>
                      <div className="text-[10px] text-hh-gray mt-0.5">
                        {relativeTime(c.last_message_at)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 border-t border-hh-gray-light flex items-center gap-2.5 shrink-0">
        <span className="h-8 w-8 rounded-full bg-gradient-to-br from-hh-orange to-hh-orange-dark text-white text-[13px] font-bold flex items-center justify-center shrink-0">
          {props.userInitial}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-hh-black truncate">
            {props.userFullName}
          </div>
          <div className="text-[11px] text-hh-gray">Member</div>
        </div>
        {props.onOpenSettings && (
          <button
            type="button"
            onClick={props.onOpenSettings}
            aria-label="Settings"
            className="p-1.5 text-hh-gray hover:text-hh-charcoal rounded-md hover:bg-hh-cream"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="p-1.5 text-hh-gray hover:text-hh-charcoal rounded-md hover:bg-hh-cream"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}

function SectionHeader({
  label,
  countBadge,
  actionLabel,
  onAction,
}: {
  label: string;
  countBadge?: number;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="px-2.5 pt-2 pb-1 flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-hh-gray">
        {label}
      </span>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-hh-orange-dark hover:text-hh-orange"
        >
          <Plus className="h-3 w-3" />
          {actionLabel}
        </button>
      ) : typeof countBadge === "number" ? (
        <span className="text-[10px] font-mono text-hh-gray">{countBadge}</span>
      ) : null}
    </div>
  );
}
