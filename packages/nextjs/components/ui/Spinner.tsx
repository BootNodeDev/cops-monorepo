type SpinnerProps = {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return <span className={`loading loading-spinner loading-${size} ${className}`} />;
}
