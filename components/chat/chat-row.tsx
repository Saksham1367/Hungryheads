"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { CHAT_MODES } from "@/lib/chat/modes";
import { relativeTime } from "@/lib/chat/util";
import type { ChatView } from "@/lib/chat/types";
import { cn } from "@/lib/utils/cn";
import { deleteChat, renameChat } from "@/app/(app)/dashboard/actions";

interface ChatRowProps {
  chat: ChatView;
  active: boolean;
  onSelect: () => void;
  /** Called after a successful delete so the parent can clear local state if
   *  the deleted chat was the active one. */
  onDeleted: (chatId: string) => void;
}

/**
 * Sidebar chat row with hover-revealed kebab → rename / delete.
 * Inline edit (no modal) for rename — same row morphs into an input.
 * Delete confirms inline with red text below the row.
 */
export function ChatRow({ chat, active, onSelect, onDeleted }: ChatRowProps) {
  const mode = CHAT_MODES[chat.mode];
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chat.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Click outside closes the kebab menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  // Focus the rename input when it appears.
  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const startRename = () => {
    setMenuOpen(false);
    setError(null);
    setDraftTitle(chat.title);
    setRenaming(true);
  };

  const submitRename = async () => {
    if (draftTitle.trim() === chat.title || draftTitle.trim().length === 0) {
      setRenaming(false);
      setError(null);
      return;
    }
    setPending(true);
    try {
      const result = await renameChat(chat.id, draftTitle);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRenaming(false);
      setError(null);
    } finally {
      setPending(false);
    }
  };

  const cancelRename = () => {
    setRenaming(false);
    setDraftTitle(chat.title);
    setError(null);
  };

  const onConfirmDelete = async () => {
    setError(null);
    setPending(true);
    try {
      await deleteChat(chat.id);
      onDeleted(chat.id);
      // No state cleanup needed — row vanishes on revalidation.
    } catch (err) {
      console.error("[ChatRow] delete threw:", err);
      setError(err instanceof Error ? err.message : "Delete failed.");
      setPending(false);
    }
  };

  // ─── Render: rename mode ────────────────────────────────────────────────
  if (renaming) {
    return (
      <div className="px-2.5 py-1.5">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") cancelRename();
            }}
            disabled={pending}
            maxLength={80}
            className="flex-1 min-w-0 h-7 px-2 text-[13px] rounded border border-hh-orange focus:outline-none focus:ring-2 focus:ring-hh-orange/30 bg-white text-hh-black"
          />
          <button
            type="button"
            onClick={submitRename}
            disabled={pending}
            aria-label="Save"
            className="h-7 w-7 inline-flex items-center justify-center rounded text-hh-orange-dark hover:bg-hh-orange-light disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={cancelRename}
            disabled={pending}
            aria-label="Cancel"
            className="h-7 w-7 inline-flex items-center justify-center rounded text-hh-gray hover:bg-hh-cream"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && (
          <p className="text-[10px] text-hh-danger mt-1 px-1" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ─── Render: confirm delete ─────────────────────────────────────────────
  if (confirmingDelete) {
    return (
      <div className="px-2.5 py-2 rounded-lg bg-red-50 border border-hh-danger/30 mx-1">
        <div className="text-[12px] text-hh-danger font-medium mb-1.5">
          Delete &ldquo;{chat.title}&rdquo;?
        </div>
        <div className="text-[10px] text-hh-gray mb-2">
          Permanent. Messages can&apos;t be recovered.
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onConfirmDelete}
            disabled={pending}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider bg-hh-danger text-white hover:bg-red-600 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            disabled={pending}
            className="px-2 py-1 rounded text-[11px] font-semibold text-hh-charcoal hover:bg-white"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="text-[10px] text-hh-danger mt-1.5" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ─── Render: default row + hover kebab ──────────────────────────────────
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
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
        <div className="flex-1 min-w-0 pr-6">
          <div className="text-[13px] font-medium text-hh-charcoal leading-snug truncate">
            {chat.title}
          </div>
          <div className="text-[10px] text-hh-gray mt-0.5">
            {relativeTime(chat.last_message_at)}
          </div>
        </div>
      </button>

      {/* Kebab — hover reveal on desktop, always visible on touch */}
      <div
        ref={menuRef}
        className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          aria-label="Chat actions"
          className="h-6 w-6 inline-flex items-center justify-center rounded text-hh-gray hover:text-hh-charcoal hover:bg-white"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-7 z-10 min-w-[140px] rounded-lg bg-white border border-hh-gray-light shadow-lg overflow-hidden animate-fade-in"
          >
            <button
              type="button"
              role="menuitem"
              onClick={startRename}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-hh-charcoal hover:bg-hh-cream"
            >
              <Pencil className="h-3 w-3" />
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setConfirmingDelete(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-hh-danger hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
