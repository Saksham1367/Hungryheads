"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  createHuddle,
  joinHuddleByCode,
} from "@/app/(app)/dashboard/huddle-actions";
import { cn } from "@/lib/utils/cn";

type Tab = "create" | "join";

export function HuddleModal({
  open,
  initialTab = "create",
  onClose,
}: {
  open: boolean;
  initialTab?: Tab;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Re-sync the tab when the dialog re-opens with a different intent.
  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
      setName("");
      setCode("");
    }
  }, [open, initialTab]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const dialogRef = useRef<HTMLDivElement>(null);
  // Autofocus the right input when tab changes.
  useEffect(() => {
    if (!open) return;
    const target = dialogRef.current?.querySelector<HTMLInputElement>(
      'input[autofocus]',
    );
    target?.focus();
  }, [open, tab]);

  if (!open) return null;

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      if (tab === "create") {
        const result = await createHuddle(name);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/huddle/${result.code}`);
        onClose();
      } else {
        const result = await joinHuddleByCode(code);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/huddle/${result.code}`);
        onClose();
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Card */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl bg-white border border-hh-gray-light shadow-2xl overflow-hidden"
      >
        <header className="px-5 py-4 flex items-center justify-between border-b border-hh-gray-light">
          <div>
            <h2 className="font-display text-lg font-extrabold text-hh-black">
              Huddle up
            </h2>
            <p className="text-xs text-hh-gray mt-0.5">
              Group ordering, group decisions. One code, persistent forever.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-hh-gray hover:text-hh-charcoal hover:bg-hh-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Tabs */}
        <div className="px-5 pt-4">
          <div className="inline-flex p-1 bg-hh-cream border border-hh-gray-light rounded-full gap-0.5 w-full">
            <TabButton active={tab === "create"} onClick={() => setTab("create")}>
              <Plus className="h-3.5 w-3.5" />
              Create
            </TabButton>
            <TabButton active={tab === "join"} onClick={() => setTab("join")}>
              <Users className="h-3.5 w-3.5" />
              Join with code
            </TabButton>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="px-5 py-4 space-y-4"
        >
          {tab === "create" ? (
            <div className="space-y-1.5">
              <Label htmlFor="huddle-name">Huddle name</Label>
              <Input
                id="huddle-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Friday Friends"
                maxLength={48}
                autoComplete="off"
                /* eslint-disable-next-line jsx-a11y/no-autofocus */
                autoFocus
              />
              <p className="text-[11px] text-hh-gray">
                You&apos;ll get a 6-letter invite code to share with friends.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="huddle-code">Invite code</Label>
              <Input
                id="huddle-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().slice(0, 6))
                }
                placeholder="4FRENZ"
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
                className="uppercase tracking-[0.4em] font-mono text-center text-lg"
                /* eslint-disable-next-line jsx-a11y/no-autofocus */
                autoFocus
              />
              <p className="text-[11px] text-hh-gray">
                6 letters/numbers. Ask a member of the huddle for theirs.
              </p>
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

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={
                pending ||
                (tab === "create" ? name.trim().length < 2 : code.length !== 6)
              }
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tab === "create" ? "Create huddle" : "Join huddle"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
        active
          ? "bg-white text-hh-black shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
          : "text-hh-charcoal hover:text-hh-black",
      )}
    >
      {children}
    </button>
  );
}
