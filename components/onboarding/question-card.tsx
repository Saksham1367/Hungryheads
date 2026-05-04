import { cn } from "@/lib/utils/cn";

export function QuestionCard({
  step,
  eyebrow,
  title,
  subtitle,
  children,
  className,
}: {
  step: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      key={step} // re-mounts on step change → re-runs animate-fade-in
      className={cn(
        "space-y-6 animate-fade-in",
        className,
      )}
    >
      <div className="space-y-2">
        {eyebrow && (
          <span className="text-xs font-semibold uppercase tracking-wider text-hh-orange-dark">
            {eyebrow}
          </span>
        )}
        <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-hh-black text-balance">
          {title}
        </h2>
        {subtitle && (
          <p className="text-base text-hh-charcoal">{subtitle}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Reusable selectable chip — used for cuisines + allergies (multi-select)
 * and as a base for single-select cards.
 */
export function Chip({
  selected,
  onToggle,
  children,
  ariaPressed,
}: {
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  ariaPressed?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ariaPressed ?? selected}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium",
        "border transition-colors",
        selected
          ? "bg-hh-orange border-hh-orange text-white shadow-sm"
          : "bg-white border-hh-gray-light text-hh-charcoal hover:border-hh-orange hover:text-hh-orange-dark",
      )}
    >
      {children}
    </button>
  );
}

/** Selectable card — used for diet, radius, personality. */
export function SelectableCard({
  selected,
  onSelect,
  children,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative text-left rounded-xl border bg-white p-4 transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-hh-orange ring-2 ring-hh-orange/20 shadow-sm"
          : "border-hh-gray-light hover:border-hh-orange/60",
        className,
      )}
    >
      {children}
    </button>
  );
}
