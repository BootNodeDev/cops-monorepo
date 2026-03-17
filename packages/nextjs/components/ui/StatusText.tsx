type StatusTextProps = {
  message: string;
  variant?: "default" | "error" | "success" | "warning";
  className?: string;
};

const variantStyles: Record<string, string> = {
  default: "border-base-300/50 bg-base-300/20 text-base-content/70",
  error: "border-error/30 bg-error/10 text-error",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
};

const variantIcons: Record<string, string> = {
  default: "\u2139",
  error: "\u2717",
  success: "\u2713",
  warning: "\u26A0",
};

export function StatusText({ message, variant = "default", className = "" }: StatusTextProps) {
  if (!message) return null;
  return (
    <div
      className={`flex w-full items-center gap-2 rounded-lg border
        px-3 py-2 text-sm ${variantStyles[variant]} ${className}`}
    >
      <span className="shrink-0 text-xs">{variantIcons[variant]}</span>
      {message}
    </div>
  );
}
