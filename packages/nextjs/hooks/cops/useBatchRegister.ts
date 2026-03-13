"use client";

import { useCallback, useMemo, useState } from "react";
import { FhevmInstance, useFHEEncryption } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Abi } from "viem";
import { type PendingEmployee, validateRow } from "~~/utils/cops/csvParser";
import { USDC_MULTIPLIER } from "~~/utils/cops/formatters";

export type RegisterStep = "idle" | "encrypting" | "submitting" | "confirming" | "done" | "error";

export function useBatchRegister(params: {
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  payrollAddress: `0x${string}` | undefined;
  payrollAbi: Abi | undefined;
  rows: PendingEmployee[];
}) {
  const { instance, ethersSigner, payrollAddress, payrollAbi, rows } = params;
  const [step, setStep] = useState<RegisterStep>("idle");
  const [message, setMessage] = useState("");

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: payrollAddress,
  });

  const validRows = useMemo(() => rows.filter(r => !validateRow(r)), [rows]);

  const canRegister = useMemo(
    () =>
      Boolean(
        instance &&
          ethersSigner &&
          payrollAddress &&
          payrollAbi &&
          validRows.length > 0 &&
          step !== "encrypting" &&
          step !== "submitting" &&
          step !== "confirming",
      ),
    [instance, ethersSigner, payrollAddress, payrollAbi, validRows.length, step],
  );

  const register = useCallback(async () => {
    if (!canRegister || !ethersSigner || !payrollAddress || !payrollAbi) return;

    setStep("encrypting");
    setMessage(`Encrypting ${validRows.length} salaries...`);

    try {
      const wallets: string[] = [];
      const names: string[] = [];
      const roles: string[] = [];
      const encSalaries: string[] = [];
      const inputProofs: string[] = [];

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const salaryRaw = BigInt(Math.round(Number(row.monthlySalaryUsdc) * Number(USDC_MULTIPLIER)));
        setMessage(`Encrypting salary ${i + 1}/${validRows.length}...`);

        const enc = await encryptWith(builder => {
          builder.add64(salaryRaw);
        });
        if (!enc) throw new Error("Encryption failed");

        wallets.push(row.address);
        names.push(row.name);
        roles.push(row.role);
        encSalaries.push(ethers.hexlify(enc.handles[0]));
        inputProofs.push(ethers.hexlify(enc.inputProof));
      }

      setStep("submitting");
      setMessage("Submitting transaction...");

      const contract = new ethers.Contract(payrollAddress, payrollAbi as ethers.InterfaceAbi, ethersSigner);
      const tx = await contract.batchAddEmployees(wallets, names, roles, encSalaries, inputProofs);

      setStep("confirming");
      setMessage("Waiting for confirmation...");
      await tx.wait();

      setStep("done");
      setMessage(`Registered ${validRows.length} employees`);
    } catch (e) {
      setStep("error");
      setMessage(`Registration failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [canRegister, ethersSigner, payrollAddress, payrollAbi, validRows, encryptWith]);

  return {
    canRegister,
    register,
    isProcessing: step === "encrypting" || step === "submitting" || step === "confirming",
    step,
    message,
  };
}
