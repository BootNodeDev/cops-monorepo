type CryptoAmountProps = {
  amount: bigint;
  decimals?: number;
  symbol?: string;
  className?: string;
};

export function CryptoAmount({ amount, decimals = 6, symbol = "USDC", className = "" }: CryptoAmountProps) {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;
  const formatted = `${whole.toLocaleString("en-US")}.${frac.toString().padStart(decimals, "0").slice(0, 2)}`;

  return (
    <span className={`font-mono tabular-nums tracking-tight ${className}`}>
      {formatted}
      <span className="ml-1 text-[0.85em] text-base-content/50">{symbol}</span>
    </span>
  );
}
