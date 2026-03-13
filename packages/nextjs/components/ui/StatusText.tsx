type StatusTextProps = {
  message: string;
  variant?: "default" | "error" | "success" | "warning";
  className?: string;
};

const variantClasses: Record<string, string> = {
  default: "text-base-content/70",
  error: "text-error",
  success: "text-success",
  warning: "text-warning",
};

export function StatusText({ message, variant = "default", className = "" }: StatusTextProps) {
  if (!message) return null;
  return <p className={`text-sm ${variantClasses[variant]} ${className}`}>{message}</p>;
}
