"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Paperclip,
  Send,
  Square,
  X,
} from "lucide-react";
import type { ChatMode } from "@/types/domain";
import { CHAT_MODES } from "@/lib/chat/modes";
import {
  ACCEPTED_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
  classifyAttachment,
  formatBytes,
} from "@/lib/chat/attachments";
import { cn } from "@/lib/utils/cn";

export function Composer({
  mode,
  onSend,
  disabled,
  streaming,
  onStop,
}: {
  mode: ChatMode;
  onSend: (text: string, file: File | null) => void;
  disabled?: boolean;
  /** True while a reply is streaming — swaps Send for a Stop button. */
  streaming?: boolean;
  /** Abort the in-flight stream. */
  onStop?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    if ((!t && !file) || disabled) return;
    onSend(t, file);
    setDraft("");
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.size > MAX_ATTACHMENT_BYTES) {
      setFileError(
        `File too large — max ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
      );
      e.target.value = "";
      return;
    }
    const kind = classifyAttachment(f.type, f.name);
    if (!kind) {
      setFileError(
        "Unsupported file type. Allowed: images (JPG, PNG, GIF, WebP), PDF, DOC, DOCX, XLS, XLSX, CSV.",
      );
      e.target.value = "";
      return;
    }
    setFile(f);
  };

  const clearFile = () => {
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canSend = (draft.trim().length > 0 || file !== null) && !disabled;

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
          {file && (
            <AttachmentChip file={file} onRemove={clearFile} />
          )}

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
            placeholder={
              file
                ? "Ask anything about this file…"
                : `Ask anything about food, restaurants, your orders…   try: "reorder my Sunday breakfast"`
            }
            rows={1}
            disabled={disabled}
            className="w-full resize-none border-none outline-none bg-transparent font-sans text-[14.5px] text-hh-black placeholder:text-hh-gray py-2 leading-[1.5] disabled:opacity-60"
          />
          <div className="flex items-center justify-between px-1 pb-0.5">
            <div className="flex gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={onPickFile}
                className="hidden"
                aria-hidden
                tabIndex={-1}
              />
              <ToolButton
                title="Attach an image or document (JPG, PNG, GIF, WebP, PDF, DOC, DOCX, XLS, XLSX, CSV — max 5 MB)"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <Paperclip className="h-4 w-4" />
              </ToolButton>
            </div>
            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-hh-black text-white hover:bg-hh-charcoal text-[13px] font-semibold transition-colors"
                aria-label="Stop generating"
              >
                Stop
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-hh-orange text-white hover:bg-hh-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-[13px] font-semibold transition-colors"
              >
                Send
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {fileError && (
          <div
            role="alert"
            className="mt-2 px-3 py-1.5 rounded-lg bg-red-50 border border-hh-danger/30 text-xs text-hh-danger"
          >
            {fileError}
          </div>
        )}

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

function AttachmentChip({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const kind = classifyAttachment(file.type, file.name);
  const isImage = kind === "image";
  const isSheet = kind === "xls" || kind === "xlsx" || kind === "csv";
  const Icon = isImage ? ImageIcon : isSheet ? FileSpreadsheet : FileText;
  const tone = isImage
    ? "text-violet-600"
    : isSheet
      ? "text-emerald-600"
      : "text-hh-orange-dark";

  // Image preview via an object URL, revoked on unmount / file change.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-hh-cream border border-hh-gray-light max-w-fit">
      {isImage && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={file.name}
          className="h-10 w-10 rounded-lg object-cover border border-hh-gray-light shrink-0"
        />
      ) : (
        <span
          className={cn(
            "inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-hh-gray-light shrink-0",
            tone,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 max-w-[260px]">
        <div className="text-[12.5px] font-semibold text-hh-charcoal truncate">
          {file.name}
        </div>
        <div className="text-[10.5px] text-hh-gray tabular">
          {formatBytes(file.size)} ·{" "}
          {isImage ? "IMAGE" : (kind?.toUpperCase() ?? "FILE")}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="ml-1 h-6 w-6 inline-flex items-center justify-center rounded-full text-hh-gray hover:text-hh-charcoal hover:bg-white transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ToolButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
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
