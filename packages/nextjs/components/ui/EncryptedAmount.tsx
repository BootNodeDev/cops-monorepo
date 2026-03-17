import { CryptoAmount } from "./CryptoAmount";
import { Spinner } from "./Spinner";

type EncryptedAmountProps = {
  clearValue: bigint | undefined;
  decimals?: number;
  symbol?: string;
  onReveal?: () => void;
  isRevealing?: boolean;
  denied?: boolean;
  className?: string;
};

function LockOpen() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 text-success"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M14.5 1A4.5 4.5 0 0010 5.5V9H3a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1.5V5.5a3 3 0 116 0v2.75a.75.75 0 001.5 0V5.5A4.5 4.5 0 0014.5 1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LockClosed() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 text-primary"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function EncryptedAmount({
  clearValue,
  decimals = 6,
  symbol = "USDC",
  onReveal,
  isRevealing,
  denied,
  className = "",
}: EncryptedAmountProps) {
  if (clearValue !== undefined) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-lg border
          border-success/20 bg-success/5 px-3 py-1.5 glow-green ${className}`}
      >
        <LockOpen />
        <CryptoAmount amount={clearValue} decimals={decimals} symbol={symbol} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg border
        border-primary/20 bg-primary/5 px-3 py-1.5 glow-blue ${className}`}
    >
      <LockClosed />
      <span className="encrypted-dots font-mono text-base-content/40" />
      {isRevealing && <Spinner size="xs" />}
      {!isRevealing && denied && <span className="text-xs text-base-content/30">No access</span>}
      {!isRevealing && !denied && onReveal && (
        <button type="button" className="btn btn-xs btn-ghost text-primary" onClick={onReveal}>
          Reveal
        </button>
      )}
    </span>
  );
}
