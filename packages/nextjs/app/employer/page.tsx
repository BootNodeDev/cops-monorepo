"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
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
  const [revealId, setRevealId] = useState<number | undefined>();
  const salary = useEmployeeSalary({
    instance,
    ethersSigner,
    chainId: ethChainId,
    payrollAddress: contracts.payrollAddress,
    payrollAbi: contracts.payrollAbi,
    employeeId: revealId,
  });
  const [revealedSalaries, setRevealedSalaries] = useState<Record<number, bigint>>({});

  const handleReveal = useCallback(
    (id: number) => {
      setRevealId(id);
      salary.decrypt();
    },
    [salary],
  );

  // Cache revealed salary
  if (revealId && salary.salaryClear !== undefined && !(revealId in revealedSalaries)) {
    setRevealedSalaries(prev => ({ ...prev, [revealId]: salary.salaryClear! }));
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-2xl font-bold">Employer Dashboard</h2>
        <p className="text-base-content/60">Connect your wallet to continue.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">Employer Dashboard</h1>
      {fhevmStatus === "loading" && <StatusText message="Initializing FHE..." variant="warning" />}
      {fhevmStatus === "error" && <StatusText message="FHE initialization failed" variant="error" />}

      {/* ─── Registered Employees ───────────────────────────────────── */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title">Registered Employees ({employees.length})</h2>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-ghost" onClick={handleCsvExport} disabled={employees.length === 0}>
                Export CSV
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => refetchEmployees()}>
                {loadingEmployees ? <Spinner size="xs" /> : "Refresh"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
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
                  <tr key={emp.id} className={emp.active ? "" : "opacity-50"}>
                    <td>{emp.id}</td>
                    <td className="font-mono text-xs">
                      {emp.wallet.slice(0, 8)}...{emp.wallet.slice(-4)}
                    </td>
                    <td>{emp.name}</td>
                    <td>{emp.role}</td>
                    <td>
                      <span className={`badge badge-sm ${emp.active ? "badge-success" : "badge-ghost"}`}>
                        {emp.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <EncryptedAmount
                        clearValue={revealedSalaries[emp.id]}
                        onReveal={() => handleReveal(emp.id)}
                        isRevealing={revealId === emp.id && salary.isDecrypting}
                      />
                    </td>
                    <td className="text-xs">
                      {emp.lastPaidAt === 0n ? "Never" : new Date(Number(emp.lastPaidAt) * 1000).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/50">
                      No employees registered yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Add Employees (CRUD + CSV) ─────────────────────────────── */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">Add Employees</h2>
          <div className="flex gap-2 mb-2">
            <button className="btn btn-sm btn-primary" onClick={addRow}>
              + Add Row
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => csvInputRef.current?.click()}>
              Import CSV
            </button>
            <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          </div>

          {pendingRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Monthly USDC</th>
                    <th></th>
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
                          className="input input-xs input-bordered w-24"
                          type="number"
                          placeholder="6500"
                          value={row.monthlySalaryUsdc}
                          onChange={e => updateRow(row.id, "monthlySalaryUsdc", e.target.value)}
                        />
                      </td>
                      <td>
                        <button className="btn btn-xs btn-ghost btn-circle" onClick={() => removeRow(row.id)}>
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
            <div className="flex items-center gap-4 mt-2">
              <button className="btn btn-primary btn-sm" disabled={!batchRegister.canRegister} onClick={handleRegister}>
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

      {/* ─── Fund Payroll ───────────────────────────────────────────── */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">Fund Payroll</h2>
          <div className="flex flex-wrap items-end gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Amount (USDC)</span>
              </label>
              <input
                className="input input-bordered w-40"
                type="number"
                placeholder="50000"
                value={fundAmount}
                onChange={e => setFundAmount(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-sm" disabled={!fund.canMint} onClick={fund.mint}>
                {fund.step === "minting" ? <Spinner size="xs" /> : "1. Mint USDC"}
              </button>
              <button className="btn btn-sm" disabled={!fund.canApprove} onClick={fund.approve}>
                {fund.step === "approving" ? <Spinner size="xs" /> : "2. Approve"}
              </button>
              <button className="btn btn-sm btn-primary" disabled={!fund.canWrap} onClick={fund.wrap}>
                {fund.step === "wrapping" ? <Spinner size="xs" /> : "3. Wrap to cUSDC"}
              </button>
            </div>
          </div>
          {fund.currentAllowance > 0n && (
            <p className="text-xs text-base-content/50 mt-1">
              Current allowance: <CryptoAmount amount={fund.currentAllowance} />
            </p>
          )}
          <StatusText
            message={fund.message}
            variant={fund.step === "error" ? "error" : fund.step === "done" ? "success" : "default"}
          />
        </div>
      </div>

      {/* ─── Run Payroll ────────────────────────────────────────────── */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">Run Payroll</h2>
          <div className="flex items-center gap-4">
            <button className="btn btn-primary" disabled={!runPayroll.canRun} onClick={handleRunPayroll}>
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
