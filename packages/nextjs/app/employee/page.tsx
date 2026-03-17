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
    payrollAddress: contracts.payrollAddress,
    payrollAbi: contracts.payrollAbi,
  });

  const handleRevealSalary = useCallback(() => {
    if (employeeId !== undefined) salary.decrypt(employeeId);
  }, [employeeId, salary]);

  // ─── Balance Decryption ──────────────────────────────────────────────
  const balance = useEmployeeBalance({
    instance,
    ethersSigner,
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

  const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
  const zeroHandle = balance.balanceHandle === ZERO_BYTES32;
  const effectiveBalanceClear = balance.balanceClear ?? (zeroHandle ? 0n : undefined);
  const canRevealBalance = balance.canDecrypt && !zeroHandle;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-2xl font-bold">Employee Portal</h2>
        <p className="text-base-content/50">Connect your wallet to continue.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4">
      <h1 className="text-2xl font-bold">Employee Portal</h1>

      {fhevmStatus === "loading" && <StatusText message="Initializing FHE..." variant="warning" />}
      {fhevmStatus === "error" && <StatusText message="FHE initialization failed" variant="error" />}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <div className="card border border-base-300/50 bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-base">Identity</h2>
              <div className="font-mono text-xs text-base-content/50">{address}</div>
              {walletToIdResult.isLoading && <Spinner size="sm" />}
              {!walletToIdResult.isLoading && !employeeId && (
                <StatusText message="This wallet is not registered as an employee." variant="warning" />
              )}
              {myEmployee && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-base-content/40">Name</span>
                  <span>{myEmployee.name}</span>
                  <span className="text-base-content/40">Role</span>
                  <span className="text-base-content/70">{myEmployee.role}</span>
                  <span className="text-base-content/40">Status</span>
                  <span>
                    <span className={`badge badge-sm ${myEmployee.active ? "badge-success" : "badge-ghost"}`}>
                      {myEmployee.active ? "Active" : "Inactive"}
                    </span>
                  </span>
                  <span className="text-base-content/40">Last Paid</span>
                  <span className="text-base-content/70">
                    {myEmployee.lastPaidAt === 0n
                      ? "Never"
                      : new Date(Number(myEmployee.lastPaidAt) * 1000).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="card border border-base-300/50 bg-base-200">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-base">USDC Balance</h2>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => usdcBalanceResult.refetch()}>
                  {usdcBalanceResult.isFetching ? <Spinner size="xs" /> : "Refresh"}
                </button>
              </div>
              <CryptoAmount amount={usdcBalance} className="text-xl" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {employeeId && (
            <div className="card border border-primary/20 bg-base-200 glow-blue">
              <div className="card-body">
                <h2 className="card-title text-base">Monthly Salary</h2>
                <EncryptedAmount
                  clearValue={salary.salaryClear}
                  onReveal={handleRevealSalary}
                  isRevealing={salary.isDecrypting}
                  className="text-2xl"
                />
                <StatusText
                  message={salary.message}
                  variant={salary.message.includes("Failed") ? "error" : "default"}
                />
              </div>
            </div>
          )}

          <div className="card border border-base-300/50 bg-base-200">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-base">cUSDC Balance</h2>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => balance.refetch()}>
                  Refresh
                </button>
              </div>
              <EncryptedAmount
                clearValue={effectiveBalanceClear}
                symbol="cUSDC"
                onReveal={canRevealBalance ? balance.decrypt : undefined}
                isRevealing={balance.isDecrypting}
                className="text-xl"
              />
              <StatusText message={balance.message} />

              {effectiveBalanceClear != null && effectiveBalanceClear > 0n && (
                <>
                  <div className="divider my-1 text-xs text-base-content/30">Unwrap to USDC</div>
                  <div className="flex gap-2">
                    <div className="join flex-1">
                      <input
                        id="unwrap-amount"
                        className="input input-bordered input-sm join-item w-full"
                        type="number"
                        placeholder="Amount"
                        value={unwrapAmount}
                        onChange={e => setUnwrapAmount(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm join-item border-base-300"
                        onClick={() => {
                          const whole = effectiveBalanceClear / USDC_MULTIPLIER;
                          const frac = effectiveBalanceClear % USDC_MULTIPLIER;
                          const fracStr = frac > 0n ? `.${frac.toString().padStart(6, "0").replace(/0+$/, "")}` : "";
                          setUnwrapAmount(`${whole}${fracStr}`);
                        }}
                      >
                        Max
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!unwrap.canUnwrap}
                      onClick={unwrap.unwrap}
                    >
                      {unwrap.isProcessing ? (
                        <span className="flex items-center gap-2">
                          <Spinner size="xs" />
                          <span className="text-xs">
                            {unwrap.step === "encrypting" && "Encrypting..."}
                            {unwrap.step === "requesting" && "Sending tx..."}
                            {unwrap.step === "waiting_kms" && "Awaiting KMS..."}
                            {unwrap.step === "finalizing" && "Finalizing..."}
                          </span>
                        </span>
                      ) : (
                        "Unwrap"
                      )}
                    </button>
                  </div>
                  <StatusText
                    message={unwrap.message}
                    variant={unwrap.step === "error" ? "error" : unwrap.step === "done" ? "success" : "default"}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
