// Small shared building blocks so buttons, focus rings and alerts look and behave the same everywhere.

/** A navy focus ring: visible on white surfaces (gold on white is too faint to see). */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2";

/** Outlined navy button, for secondary actions. */
export const buttonClass = `rounded-lg border border-navy px-3 py-1.5 text-sm font-medium text-navy transition-colors hover:bg-silver/30 ${focusRing}`;

/** Filled navy button, for the main action on a screen. */
export const primaryButtonClass = `rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy/90 disabled:cursor-not-allowed disabled:bg-silver ${focusRing}`;

/** Errors and notices: navy border with a gold accent bar. */
export function Alert({
  children,
  className = "",
  role = "alert",
}: {
  children: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role}
      className={`rounded-lg border border-navy border-l-4 border-l-gold bg-white px-4 py-3 text-sm text-black ${className}`}
    >
      {children}
    </div>
  );
}
