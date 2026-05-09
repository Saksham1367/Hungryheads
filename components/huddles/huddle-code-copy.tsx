"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HuddleCodeCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const onCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no-op */
    }
  };

  const onShareLink = async () => {
    const url = `${window.location.origin}/huddle/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my HungryHeads huddle`,
          text: `Use code ${code} or this link:`,
          url,
        });
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onCopyCode}
        className="flex-1"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-hh-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied" : `Copy code ${code}`}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onShareLink}
        className="flex-1"
      >
        <Share2 className="h-3.5 w-3.5" />
        Share invite link
      </Button>
    </div>
  );
}
