export function formatUsdc(rawUnits: bigint, decimals = 6): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = rawUnits / divisor;
  const frac = rawUnits % divisor;
  return `$${whole.toLocaleString("en-US")}.${frac.toString().padStart(decimals, "0").slice(0, 2)}`;
}

export function formatAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatTimestamp(unix: bigint): string {
  if (unix === 0n) return "Never";
  return new Date(Number(unix) * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const USDC_DECIMALS = 6;
export const USDC_MULTIPLIER = 1_000_000n;
