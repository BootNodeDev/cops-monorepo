"use client";

import { useCallback, useMemo, useState } from "react";
import { FhevmInstance, useFHEEncryption } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Abi } from "viem";

export type UnwrapStep = "idle" | "encrypting" | "requesting" | "done" | "error";

export function useUnwrap(params: {
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  cUsdcAddress: `0x${string}` | undefined;
  cUsdcAbi: Abi | undefined;
  walletAddress: `0x${string}` | undefined;
  amount: bigint;
}) {
  const { instance, ethersSigner, cUsdcAddress, cUsdcAbi, walletAddress, amount } = params;
  const [step, setStep] = useState<UnwrapStep>("idle");
  const [message, setMessage] = useState("");

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: cUsdcAddress,
  });

  const isProcessing = step === "encrypting" || step === "requesting";

  const canUnwrap = useMemo(
    () =>
      Boolean(instance && ethersSigner && cUsdcAddress && cUsdcAbi && walletAddress && amount > 0n && !isProcessing),
    [instance, ethersSigner, cUsdcAddress, cUsdcAbi, walletAddress, amount, isProcessing],
  );

  const unwrap = useCallback(async () => {
    if (!canUnwrap || !ethersSigner || !cUsdcAddress || !cUsdcAbi || !walletAddress) return;

    setStep("encrypting");
    setMessage("Encrypting unwrap amount...");

    try {
      const enc = await encryptWith(builder => {
        builder.add64(amount);
      });
      if (!enc) throw new Error("Encryption failed");

      setStep("requesting");
      setMessage("Submitting unwrap request...");

      const contract = new ethers.Contract(cUsdcAddress, cUsdcAbi as ethers.InterfaceAbi, ethersSigner);
      const tx = await contract["unwrap(address,address,bytes32,bytes)"](
        walletAddress,
        walletAddress,
        ethers.hexlify(enc.handles[0]),
        ethers.hexlify(enc.inputProof),
      );
      await tx.wait();

      setStep("done");
      setMessage("Unwrap requested. KMS will finalize automatically.");
    } catch (e) {
      setStep("error");
      setMessage(`Unwrap failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [canUnwrap, ethersSigner, cUsdcAddress, cUsdcAbi, walletAddress, amount, encryptWith]);

  return { canUnwrap, unwrap, isProcessing, step, message };
}
