import { cn } from "@/lib/utils/cn";

/**
 * HungryHeads wordmark — Plus Jakarta Sans 800 (per brief §4.4) with a small
 * fork-and-spoon mark to the left. Pure SVG so it scales cleanly anywhere.
 */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 select-none", className)}
    >
      <LogoMark className="h-6 w-6" />
      {showWordmark && (
        <span className="font-display font-extrabold text-xl tracking-tight text-hh-black">
          Hungry<span className="text-hh-orange">Heads</span>
        </span>
      )}
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* coral-orange disc */}
      <circle cx="12" cy="12" r="11" fill="#FF6B35" />
      {/* fork */}
      <path
        d="M8.5 6v5.2c0 .7.55 1.3 1.25 1.3h.25v5.5a1 1 0 0 0 2 0V12.5h.25c.7 0 1.25-.6 1.25-1.3V6"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* spoon bowl */}
      <path
        d="M16.5 6.2c-1.1 0-2 1.1-2 2.6 0 1.3.7 2.2 1.5 2.5v6.8a1 1 0 0 0 2 0V8.8c0-1.5-.9-2.6-1.5-2.6Z"
        fill="white"
      />
    </svg>
  );
}
