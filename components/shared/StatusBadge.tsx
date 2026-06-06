// Shared status indicator: a small colored dot + short text. Replaces the older
// long filled-pill style. The dot carries the status color; text stays muted so
// the indicator reads compact and consistent across the CRM.

export default function StatusBadge({ label, color, size = "md", className = "" }: {
  label: string;
  color: string;            // the saturated status color (used for the dot)
  size?: "sm" | "md";       // sm for dense contexts (dispatch cards)
  className?: string;
}) {
  const text = size === "sm" ? "text-[10px] gap-1" : "text-xs gap-1.5";
  const dot  = size === "sm" ? "w-1 h-1" : "w-1.5 h-1.5";
  return (
    <span className={`inline-flex items-center ${text} font-medium whitespace-nowrap ${className}`}
      style={{ color: "var(--text-secondary)" }}>
      <span className={`${dot} rounded-full shrink-0`} style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
