import { CryptoAmount } from "./CryptoAmount";
import { Spinner } from "./Spinner";

type EncryptedAmountProps = {
  clearValue: bigint | undefined;
  decimals?: number;
  symbol?: string;
  onReveal?: () => void;
  isRevealing?: boolean;
  className?: string;
};

export function EncryptedAmount({
  clearValue,
  decimals = 6,
  symbol = "USDC",
  onReveal,
  isRevealing,
  className = "",
}: EncryptedAmountProps) {
  if (clearValue !== undefined) {
    return (
      <span className={`flex items-center gap-1 ${className}`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 text-success"
        >
          <path d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" />
        </svg>
        <CryptoAmount amount={clearValue} decimals={decimals} symbol={symbol} />
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-warning">
        <path
          fillRule="evenodd"
          d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-base-content/50">Encrypted</span>
      {isRevealing && <Spinner size="xs" />}
      {!isRevealing && onReveal && (
        <button className="btn btn-xs btn-ghost" onClick={onReveal}>
          Reveal
        </button>
      )}
    </span>
  );
}
