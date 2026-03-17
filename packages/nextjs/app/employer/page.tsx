"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { useAccount, useReadContract } from "wagmi";
import { CryptoAmount, EncryptedAmount, Spinner, StatusText } from "~~/components/ui";
import {
  useBatchRegister,
  useContractAddresses,
  useEmployeeSalary,
  useFundPayroll,
  usePayrollEmployees,
  useRunPayroll,
} from "~~/hooks/cops";
import { useWagmiEthers } from "~~/hooks/wagmi/useWagmiEthers";
import { useEmployerStore } from "~~/services/store/employerStore";
import { parseCsvFile, toCsvString, toPendingEmployees, validateRow } from "~~/utils/cops/csvParser";
import { USDC_MULTIPLIER } from "~~/utils/cops/formatters";

export default function EmployerPage() {
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

  const ownerResult = useReadContract({
    address: contracts.payrollAddress,
    abi: contracts.payrollAbi as any,
    functionName: "owner",
    query: { enabled: Boolean(contracts.payrollAddress) },
  });
  const contractOwner = ownerResult.data as `0x${string}` | undefined;
  const isOwner = Boolean(address && contractOwner && address.toLowerCase() === contractOwner.toLowerCase());

  const {
    employees,
    refetch: refetchEmployees,
    isLoading: loadingEmployees,
  } = usePayrollEmployees({
    ethersReadonlyProvider,
    payrollAddress: contracts.payrollAddress,
    payrollAbi: contracts.payrollAbi,
  });

  // ─── CRUD Table ──────────────────────────────────────────────────────
  const { pendingRows, addRow, updateRow, removeRow, setRows, clearRows, fundAmount, setFundAmount } =
    useEmployerStore();
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleCsvImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const rows = await parseCsvFile(file);
      setRows(toPendingEmployees(rows));
      e.target.value = "";
    },
    [setRows],
  );

  const handleCsvExport = useCallback(() => {
    const csv = toCsvString(employees);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [employees]);

  // ─── Batch Register ──────────────────────────────────────────────────
  const batchRegister = useBatchRegister({
    instance,
    ethersSigner,
    payrollAddress: contracts.payrollAddress,
    payrollAbi: contracts.payrollAbi,
    rows: pendingRows,
  });

  const handleRegister = useCallback(async () => {
    await batchRegister.register();
    if (batchRegister.step === "done") {
      clearRows();
      refetchEmployees();
    }
  }, [batchRegister, clearRows, refetchEmployees]);

  // ─── Fund Payroll ────────────────────────────────────────────────────
  const fundAmountBigInt = useMemo(() => {
    const n = Number(fundAmount);
    if (isNaN(n) || n <= 0) return 0n;
    return BigInt(Math.round(n * Number(USDC_MULTIPLIER)));
  }, [fundAmount]);

  const fund = useFundPayroll({
    ethersSigner,
    mockUsdcAddress: contracts.mockUsdcAddress,
    mockUsdcAbi: contracts.mockUsdcAbi,
    cUsdcAddress: contracts.cUsdcAddress,
    cUsdcAbi: contracts.cUsdcAbi,
    payrollAddress: contracts.payrollAddress,
    amount: fundAmountBigInt,
    userAddress: address,
  });

  // ─── Run Payroll ─────────────────────────────────────────────────────
  const runPayroll = useRunPayroll({
    ethersSigner,
    payrollAddress: contracts.payrollAddress,
    payrollAbi: contracts.payrollAbi,
  });

  const handleRunPayroll = useCallback(async () => {
    await runPayroll.run();
    refetchEmployees();
  }, [runPayroll, refetchEmployees]);

  // ─── Salary Reveal ───────────────────────────────────────────────────
  const salary = useEmployeeSalary({
    instance,
    ethersSigner,
    payrollAddress: contracts.payrollAddress,
    payrollAbi: contracts.payrollAbi,
  });
  const [revealedSalaries, setRevealedSalaries] = useState<Record<number, bigint>>({});
  const [deniedIds, setDeniedIds] = useState<Set<number>>(new Set());
  const [revealId, setRevealId] = useState<number | undefined>();

  const handleReveal = useCallback(
    async (id: number) => {
      if (revealedSalaries[id] !== undefined || deniedIds.has(id)) return;
      setRevealId(id);
      const result = await salary.decrypt(id);
      if (typeof result === "bigint") {
        setRevealedSalaries(prev => ({ ...prev, [id]: result }));
      } else if (result === "denied") {
        setDeniedIds(prev => new Set(prev).add(id));
      }
    },
    [revealedSalaries, deniedIds, salary],
  );

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-2xl font-bold">Employer Dashboard</h2>
        <p className="text-base-content/50">Connect your wallet to continue.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employer Dashboard</h1>
        <span className="font-mono text-xs text-base-content/40">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
      </div>

      {contractOwner && !isOwner && (
        <div role="alert" className="alert alert-warning">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>Warning</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="font-semibold">Read-only mode</p>
            <p className="text-xs">
              Only the contract owner can manage employees, fund payroll, and run payroll. Connect with the owner wallet
              to enable these actions.
            </p>
          </div>
        </div>
      )}

      {salary.message && (
        <StatusText
          message={salary.message}
          variant={
            salary.message.includes("fail") ||
            salary.message.includes("timeout") ||
            salary.message.includes("ACL") ||
            salary.message.includes("error")
              ? "error"
              : "default"
          }
        />
      )}

      {fhevmStatus === "loading" && <StatusText message="Initializing FHE..." variant="warning" />}
      {fhevmStatus === "error" && <StatusText message="FHE initialization failed" variant="error" />}

      <div className="card border border-base-300/50 bg-base-200">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title text-base">
              Registered Employees
              <span className="badge badge-sm badge-neutral">{employees.length}</span>
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCsvExport}
                disabled={employees.length === 0}
              >
                Export CSV
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => refetchEmployees()}>
                {loadingEmployees ? <Spinner size="xs" /> : "Refresh"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="text-base-content/50">
                  <th>ID</th>
                  <th>Address</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Salary</th>
                  <th>Last Paid</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} className={emp.active ? "" : "opacity-40"}>
                    <td className="font-mono text-xs text-base-content/50">{emp.id}</td>
                    <td className="font-mono text-xs">
                      {emp.wallet.slice(0, 8)}...{emp.wallet.slice(-4)}
                    </td>
                    <td>{emp.name}</td>
                    <td className="text-base-content/70">{emp.role}</td>
                    <td>
                      <span className={`badge badge-sm ${emp.active ? "badge-success" : "badge-ghost"}`}>
                        {emp.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <EncryptedAmount
                        clearValue={revealedSalaries[emp.id]}
                        onReveal={isOwner && !deniedIds.has(emp.id) ? () => handleReveal(emp.id) : undefined}
                        isRevealing={revealId === emp.id && salary.isDecrypting}
                        denied={deniedIds.has(emp.id)}
                      />
                    </td>
                    <td className="text-xs text-base-content/50">
                      {emp.lastPaidAt === 0n ? "Never" : new Date(Number(emp.lastPaidAt) * 1000).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/40 py-8">
                      No employees registered yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card border border-base-300/50 bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">Add Employees</h2>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={addRow} disabled={!isOwner}>
              + Add Row
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => csvInputRef.current?.click()}>
              Import CSV
            </button>
            <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          </div>

          {pendingRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="text-base-content/50">
                    <th>Address</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>USDC</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.map(row => (
                    <tr key={row.id} className={row.validationError ? "bg-error/10" : ""}>
                      <td>
                        <input
                          className="input input-xs input-bordered w-full font-mono"
                          placeholder="0x..."
                          value={row.address}
                          onChange={e => updateRow(row.id, "address", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input input-xs input-bordered w-full"
                          placeholder="Name"
                          value={row.name}
                          onChange={e => updateRow(row.id, "name", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input input-xs input-bordered w-full"
                          placeholder="Role"
                          value={row.role}
                          onChange={e => updateRow(row.id, "role", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input input-xs input-bordered w-20"
                          type="number"
                          placeholder="6500"
                          value={row.monthlySalaryUsdc}
                          onChange={e => updateRow(row.id, "monthlySalaryUsdc", e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-circle btn-xs"
                          onClick={() => removeRow(row.id)}
                        >
                          x
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pendingRows.length > 0 && (
            <div className="mt-2 space-y-2">
              <button
                type="button"
                className="btn btn-primary btn-sm w-full"
                disabled={!batchRegister.canRegister || !isOwner}
                onClick={handleRegister}
              >
                {batchRegister.isProcessing ? (
                  <Spinner size="xs" />
                ) : (
                  `Register ${pendingRows.filter(r => !validateRow(r)).length} Employees`
                )}
              </button>
              <StatusText
                message={batchRegister.message}
                variant={
                  batchRegister.step === "error" ? "error" : batchRegister.step === "done" ? "success" : "default"
                }
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card border border-base-300/50 bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-base">Fund Payroll</h2>
            <div className="form-control">
              <label className="label" htmlFor="fund-amount">
                <span className="label-text text-xs text-base-content/50">Amount (USDC)</span>
              </label>
              <input
                id="fund-amount"
                className="input input-bordered w-full"
                type="number"
                placeholder="50000"
                value={fundAmount}
                onChange={e => setFundAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" className="btn btn-sm" disabled={!fund.canMint || !isOwner} onClick={fund.mint}>
                {fund.step === "minting" ? <Spinner size="xs" /> : "1. Mint USDC"}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!fund.canApprove || !isOwner}
                onClick={fund.approve}
              >
                {fund.step === "approving" ? <Spinner size="xs" /> : "2. Approve"}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!fund.canWrap || !isOwner}
                onClick={fund.wrap}
              >
                {fund.step === "wrapping" ? <Spinner size="xs" /> : "3. Wrap to cUSDC"}
              </button>
            </div>
            {fund.currentAllowance > 0n && (
              <p className="mt-1 text-xs text-base-content/40">
                Allowance: <CryptoAmount amount={fund.currentAllowance} />
              </p>
            )}
            <StatusText
              message={fund.message}
              variant={fund.step === "error" ? "error" : fund.step === "done" ? "success" : "default"}
            />
          </div>
        </div>

        <div className="card border border-base-300/50 bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-base">Run Payroll</h2>
            <p className="text-xs text-base-content/40">
              Transfers each active employee&apos;s encrypted salary from the contract balance.
            </p>
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={!runPayroll.canRun || !isOwner}
              onClick={handleRunPayroll}
            >
              {runPayroll.isProcessing ? <Spinner size="sm" /> : "Run Payroll"}
            </button>
            <StatusText
              message={runPayroll.message}
              variant={
                runPayroll.message.includes("failed")
                  ? "error"
                  : runPayroll.message.includes("success")
                    ? "success"
                    : "default"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
