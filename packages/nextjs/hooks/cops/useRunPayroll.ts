"use client";

import { useCallback, useMemo, useState } from "react";
import { ethers } from "ethers";
import type { Abi } from "viem";

export function useRunPayroll(params: {
  ethersSigner: ethers.JsonRpcSigner | undefined;
  payrollAddress: `0x${string}` | undefined;
  payrollAbi: Abi | undefined;
}) {
  const { ethersSigner, payrollAddress, payrollAbi } = params;
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const canRun = useMemo(
    () => Boolean(ethersSigner && payrollAddress && payrollAbi && !isProcessing),
    [ethersSigner, payrollAddress, payrollAbi, isProcessing],
  );

  const run = useCallback(async () => {
    if (!ethersSigner || !payrollAddress || !payrollAbi) return;
    setIsProcessing(true);
    setMessage("Running payroll...");
    try {
      const contract = new ethers.Contract(payrollAddress, payrollAbi as ethers.InterfaceAbi, ethersSigner);
      const tx = await contract.runPayroll();
      setMessage("Waiting for confirmation...");
      await tx.wait();
      setMessage("Payroll executed successfully");
    } catch (e) {
      setMessage(`Payroll failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [ethersSigner, payrollAddress, payrollAbi]);

  return { canRun, run, isProcessing, message };
}
