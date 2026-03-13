"use client";

import { useCallback, useMemo, useState } from "react";
import { ethers } from "ethers";
import type { Abi } from "viem";
import { useReadContract } from "wagmi";

export type FundStep = "idle" | "minting" | "approving" | "wrapping" | "done" | "error";

export function useFundPayroll(params: {
  ethersSigner: ethers.JsonRpcSigner | undefined;
  mockUsdcAddress: `0x${string}` | undefined;
  mockUsdcAbi: Abi | undefined;
  cUsdcAddress: `0x${string}` | undefined;
  cUsdcAbi: Abi | undefined;
  payrollAddress: `0x${string}` | undefined;
  amount: bigint;
  userAddress: `0x${string}` | undefined;
}) {
  const { ethersSigner, mockUsdcAddress, mockUsdcAbi, cUsdcAddress, cUsdcAbi, payrollAddress, amount, userAddress } =
    params;
  const [step, setStep] = useState<FundStep>("idle");
  const [message, setMessage] = useState("");

  const allowanceResult = useReadContract({
    address: mockUsdcAddress,
    abi: mockUsdcAbi as any,
    functionName: "allowance",
    args: userAddress && cUsdcAddress ? [userAddress, cUsdcAddress] : undefined,
    query: { enabled: Boolean(mockUsdcAddress && userAddress && cUsdcAddress) },
  });

  const currentAllowance = (allowanceResult.data as bigint) ?? 0n;
  const hasSigner = Boolean(ethersSigner);
  const isProcessing = step === "minting" || step === "approving" || step === "wrapping";

  const mint = useCallback(async () => {
    if (!ethersSigner || !mockUsdcAddress || !mockUsdcAbi) return;
    setStep("minting");
    setMessage("Minting MockUSDC...");
    try {
      const contract = new ethers.Contract(mockUsdcAddress, mockUsdcAbi as ethers.InterfaceAbi, ethersSigner);
      const addr = await ethersSigner.getAddress();
      const tx = await contract.mint(addr, amount);
      await tx.wait();
      setStep("idle");
      setMessage("MockUSDC minted");
    } catch (e) {
      setStep("error");
      setMessage(`Mint failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [ethersSigner, mockUsdcAddress, mockUsdcAbi, amount]);

  const approve = useCallback(async () => {
    if (!ethersSigner || !mockUsdcAddress || !mockUsdcAbi || !cUsdcAddress) return;
    setStep("approving");
    setMessage("Approving cUSDC to spend USDC...");
    try {
      const contract = new ethers.Contract(mockUsdcAddress, mockUsdcAbi as ethers.InterfaceAbi, ethersSigner);
      const tx = await contract.approve(cUsdcAddress, amount);
      await tx.wait();
      await allowanceResult.refetch();
      setStep("idle");
      setMessage("Approved");
    } catch (e) {
      setStep("error");
      setMessage(`Approve failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [ethersSigner, mockUsdcAddress, mockUsdcAbi, cUsdcAddress, amount, allowanceResult]);

  const wrap = useCallback(async () => {
    if (!ethersSigner || !cUsdcAddress || !cUsdcAbi || !payrollAddress) return;
    setStep("wrapping");
    setMessage("Wrapping USDC to cUSDC...");
    try {
      const contract = new ethers.Contract(cUsdcAddress, cUsdcAbi as ethers.InterfaceAbi, ethersSigner);
      const tx = await contract.wrap(payrollAddress, amount);
      await tx.wait();
      setStep("done");
      setMessage("Payroll funded with cUSDC");
    } catch (e) {
      setStep("error");
      setMessage(`Wrap failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [ethersSigner, cUsdcAddress, cUsdcAbi, payrollAddress, amount]);

  return {
    canMint: useMemo(() => hasSigner && amount > 0n && !isProcessing, [hasSigner, amount, isProcessing]),
    canApprove: useMemo(() => hasSigner && amount > 0n && !isProcessing, [hasSigner, amount, isProcessing]),
    canWrap: useMemo(
      () => hasSigner && amount > 0n && currentAllowance >= amount && !isProcessing,
      [hasSigner, amount, currentAllowance, isProcessing],
    ),
    mint,
    approve,
    wrap,
    isProcessing,
    step,
    message,
    currentAllowance,
  };
}
