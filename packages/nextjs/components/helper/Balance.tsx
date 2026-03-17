"use client";

import { Address, formatEther } from "viem";
import { useTargetNetwork } from "~~/hooks/helper/useTargetNetwork";
import { useWatchBalance } from "~~/hooks/helper/useWatchBalance";

type BalanceProps = {
  address?: Address;
  className?: string;
  usdMode?: boolean;
};

/**
 * Display (ETH & USD) balance of an ETH address.
 */
export const Balance = ({ address, className = "" }: BalanceProps) => {
  const { targetNetwork } = useTargetNetwork();

  const {
    data: balance,
    isError,
    isLoading,
  } = useWatchBalance({
    address,
  });

  if (!address || isLoading || balance === null) {
    return (
      <div className="flex animate-pulse items-center gap-2">
        <div className="h-2 w-20 rounded bg-base-300" />
      </div>
    );
  }

  if (isError) {
    return <span className="text-xs text-warning">Error</span>;
  }

  const formattedBalance = balance ? Number(formatEther(balance.value)) : 0;

  return (
    <span className={`font-mono text-sm tabular-nums text-base-content/70 ${className}`}>
      {formattedBalance.toFixed(4)}
      <span className="ml-1 text-[0.8em] text-base-content/40">{targetNetwork.nativeCurrency.symbol}</span>
    </span>
  );
};
