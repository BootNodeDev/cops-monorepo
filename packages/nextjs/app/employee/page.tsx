"use client";

import { useCallback, useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { useReadContract } from "wagmi";
import { CryptoAmount, EncryptedAmount, Spinner, StatusText } from "~~/components/ui";
import { useContractAddresses, useEmployeeBalance, useEmployeeSalary, useUnwrap } from "~~/hooks/cops";
import { usePayrollEmployees } from "~~/hooks/cops";
import { useWagmiEthers } from "~~/hooks/wagmi/useWagmiEthers";
import { USDC_MULTIPLIER } from "~~/utils/cops/formatters";

export default function EmployeePage() {
  const { isConnected, chain, address } = useAccount();
  const chainId = chain?.id;

  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);

  const { instance, status: fhevmStatus } = useFhevm({
    provider,
    chainId,
    enabled: isConnected,
  });

  const { chainId: ethChainId, ethersSigner, ethersReadonlyProvider } = useWagmiEthers();
  const contracts = useContractAddresses(ethChainId);

  // ─── Auto-detect employee ────────────────────────────────────────────
  const walletToIdResult = useReadContract({
    address: contracts.payrollAddress,
    abi: contracts.payrollAbi as any,
    functionName: "walletToId",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(contracts.payrollAddress && address) },
  });

  const employeeId = useMemo(() => {
    const id = walletToIdResult.data as bigint | undefined;
    if (!id || id === 0n) return undefined;
    return Number(id);
  }, [walletToIdResult.data]);

  const { employees } = usePayrollEmployees({
    ethersReadonlyProvider,
    payrollAddress: contracts.payrollAddress,
    payrollAbi: contracts.payrollAbi,
  });

  const myEmployee = useMemo(() => employees.find(e => e.id === employeeId), [employees, employeeId]);

  // ─── Salary Decryption ───────────────────────────────────────────────
  const salary = useEmployeeSalary({
    instance,
    ethersSigner,
    chainId: ethChainId,
    payrollAddress: contracts.payrollAddress,
    payrollAbi: contracts.payrollAbi,
    employeeId,
  });

  // ─── Balance Decryption ──────────────────────────────────────────────
  const balance = useEmployeeBalance({
    instance,
    ethersSigner,
    chainId: ethChainId,
    cUsdcAddress: contracts.cUsdcAddress,
    cUsdcAbi: contracts.cUsdcAbi,
    walletAddress: address,
  });

  // ─── Plain USDC Balance ─────────────────────────────────────────────
  const usdcBalanceResult = useReadContract({
    address: contracts.mockUsdcAddress,
    abi: contracts.mockUsdcAbi as any,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(contracts.mockUsdcAddress && address) },
  });
  const usdcBalance = (usdcBalanceResult.data as bigint) ?? 0n;

  // ─── Unwrap ──────────────────────────────────────────────────────────
  const [unwrapAmount, setUnwrapAmount] = useState("");
  const unwrapBigInt = useMemo(() => {
    const n = Number(unwrapAmount);
    if (isNaN(n) || n <= 0) return 0n;
    return BigInt(Math.round(n * Number(USDC_MULTIPLIER)));
  }, [unwrapAmount]);

  const handleUnwrapComplete = useCallback(() => {
    balance.refetch();
    usdcBalanceResult.refetch();
  }, [balance, usdcBalanceResult]);

  const unwrap = useUnwrap({
    instance,
    ethersSigner,
    cUsdcAddress: contracts.cUsdcAddress,
    cUsdcAbi: contracts.cUsdcAbi,
    walletAddress: address,
    amount: unwrapBigInt,
    onComplete: handleUnwrapComplete,
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-2xl font-bold">Employee Portal</h2>
        <p className="text-base-content/60">Connect your wallet to continue.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Employee Portal</h1>
      {fhevmStatus === "loading" && <StatusText message="Initializing FHE..." variant="warning" />}
      {fhevmStatus === "error" && <StatusText message="FHE initialization failed" variant="error" />}

      {/* ─── Identity Card ──────────────────────────────────────────── */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">Your Identity</h2>
          <div className="font-mono text-sm text-base-content/70">{address}</div>
          {walletToIdResult.isLoading && <Spinner size="sm" />}
          {!walletToIdResult.isLoading && !employeeId && (
            <StatusText message="This wallet is not registered as an employee." variant="warning" />
          )}
          {myEmployee && (
            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
              <span className="text-base-content/50">Name</span>
              <span>{myEmployee.name}</span>
              <span className="text-base-content/50">Role</span>
              <span>{myEmployee.role}</span>
              <span className="text-base-content/50">Status</span>
              <span>
                <span className={`badge badge-sm ${myEmployee.active ? "badge-success" : "badge-ghost"}`}>
                  {myEmployee.active ? "Active" : "Inactive"}
                </span>
              </span>
              <span className="text-base-content/50">Last Paid</span>
              <span>
                {myEmployee.lastPaidAt === 0n
                  ? "Never"
                  : new Date(Number(myEmployee.lastPaidAt) * 1000).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Salary ─────────────────────────────────────────────────── */}
      {employeeId && (
        <div className="card bg-base-200 shadow">
          <div className="card-body">
            <h2 className="card-title">Monthly Salary</h2>
            <div className="flex items-center gap-4">
              <EncryptedAmount
                clearValue={salary.salaryClear}
                onReveal={salary.decrypt}
                isRevealing={salary.isDecrypting}
                className="text-xl"
              />
            </div>
            <StatusText message={salary.message} variant={salary.message.includes("Failed") ? "error" : "default"} />
          </div>
        </div>
      )}

      {/* ─── cUSDC Balance ──────────────────────────────────────────── */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">cUSDC Balance</h2>
          <div className="flex items-center gap-4">
            <EncryptedAmount
              clearValue={balance.balanceClear}
              symbol="cUSDC"
              onReveal={balance.decrypt}
              isRevealing={balance.isDecrypting}
              className="text-xl"
            />
            <button className="btn btn-xs btn-ghost" onClick={() => balance.refetch()}>
              Refresh
            </button>
          </div>
          <StatusText message={balance.message} />
        </div>
      </div>

      {/* ─── Plain USDC Balance ─────────────────────────────────────── */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">USDC Balance (plain)</h2>
          <div className="flex items-center gap-4">
            <CryptoAmount amount={usdcBalance} className="text-xl" />
            <button className="btn btn-xs btn-ghost" onClick={() => usdcBalanceResult.refetch()}>
              {usdcBalanceResult.isFetching ? <Spinner size="xs" /> : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Unwrap to USDC ─────────────────────────────────────────── */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">Unwrap to USDC</h2>
          <p className="text-sm text-base-content/60">
            Burns cUSDC and requests plain USDC via KMS. The amount becomes visible on-chain after finalization.
          </p>
          <div className="flex items-end gap-4 mt-2">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Amount (USDC)</span>
              </label>
              <input
                className="input input-bordered w-40"
                type="number"
                placeholder="1000"
                value={unwrapAmount}
                onChange={e => setUnwrapAmount(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" disabled={!unwrap.canUnwrap} onClick={unwrap.unwrap}>
              {unwrap.isProcessing ? <Spinner size="sm" /> : "Unwrap"}
            </button>
          </div>
          <StatusText
            message={unwrap.message}
            variant={unwrap.step === "error" ? "error" : unwrap.step === "done" ? "success" : "default"}
          />
        </div>
      </div>
    </div>
  );
}
