export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <div
      className="relative flex items-center text-xs text-hh-gray"
      aria-hidden
    >
      <div className="flex-1 border-t border-hh-gray-light" />
      <span className="px-3 uppercase tracking-wider">{label}</span>
      <div className="flex-1 border-t border-hh-gray-light" />
    </div>
  );
}
