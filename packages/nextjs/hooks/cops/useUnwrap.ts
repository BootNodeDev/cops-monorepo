"use client";

import { useCallback, useMemo, useState } from "react";
import { FhevmInstance, useFHEEncryption } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Abi } from "viem";

export type UnwrapStep = "idle" | "encrypting" | "requesting" | "waiting_kms" | "finalizing" | "done" | "error";

const MAX_POLL_ATTEMPTS = 30;
const POLL_BASE_DELAY_MS = 3000;
const POLL_INCREMENT_MS = 1000;

export function useUnwrap(params: {
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  cUsdcAddress: `0x${string}` | undefined;
  cUsdcAbi: Abi | undefined;
  walletAddress: `0x${string}` | undefined;
  amount: bigint;
  onComplete?: () => void;
}) {
  const { instance, ethersSigner, cUsdcAddress, cUsdcAbi, walletAddress, amount, onComplete } = params;
  const [step, setStep] = useState<UnwrapStep>("idle");
  const [message, setMessage] = useState("");

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: cUsdcAddress,
  });

  const isProcessing =
    step === "encrypting" || step === "requesting" || step === "waiting_kms" || step === "finalizing";

  const canUnwrap = useMemo(
    () =>
      Boolean(instance && ethersSigner && cUsdcAddress && cUsdcAbi && walletAddress && amount > 0n && !isProcessing),
    [instance, ethersSigner, cUsdcAddress, cUsdcAbi, walletAddress, amount, isProcessing],
  );

  const unwrap = useCallback(async () => {
    if (!canUnwrap || !instance || !ethersSigner || !cUsdcAddress || !cUsdcAbi || !walletAddress) return;

    setStep("encrypting");
    setMessage("Encrypting unwrap amount...");

    try {
      // Step 1: Encrypt the unwrap amount
      const enc = await encryptWith(builder => {
        builder.add64(amount);
      });
      if (!enc) throw new Error("Encryption failed");

      // Step 2: Submit unwrap tx (burns cUSDC, calls makePubliclyDecryptable)
      setStep("requesting");
      setMessage("Submitting unwrap request...");

      const contract = new ethers.Contract(cUsdcAddress, cUsdcAbi as ethers.InterfaceAbi, ethersSigner);
      const tx = await contract["unwrap(address,address,bytes32,bytes)"](
        walletAddress,
        walletAddress,
        ethers.hexlify(enc.handles[0]),
        ethers.hexlify(enc.inputProof),
      );
      const receipt = await tx.wait();

      // Parse UnwrapRequested event to get burntAmount handle
      const unwrapEvent = receipt.logs.find((log: ethers.Log) => {
        try {
          const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
          return parsed?.name === "UnwrapRequested";
        } catch {
          return false;
        }
      });

      if (!unwrapEvent) {
        throw new Error("UnwrapRequested event not found in transaction receipt");
      }

      const parsed = contract.interface.parseLog({
        topics: [...unwrapEvent.topics],
        data: unwrapEvent.data,
      });
      // UnwrapRequested(address indexed receiver, euint64 amount)
      const burntHandle = parsed?.args?.[1];

      if (!burntHandle) {
        throw new Error("Could not extract burntAmount handle from UnwrapRequested event");
      }

      // Step 3: Poll KMS via publicDecrypt until proof is available
      setStep("waiting_kms");
      setMessage("Waiting for KMS decryption proof...");

      let cleartext: bigint | undefined;
      let decryptionProof: string | undefined;

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        const delay = POLL_BASE_DELAY_MS + attempt * POLL_INCREMENT_MS;
        await new Promise(resolve => setTimeout(resolve, delay));
        setMessage(`Waiting for KMS proof... (attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS})`);

        try {
          const result = await instance.publicDecrypt([burntHandle]);
          if (result && result.clearValues && result.decryptionProof) {
            const handleKey = burntHandle.toLowerCase();
            const rawValue = result.clearValues[handleKey] ?? result.clearValues[burntHandle];
            if (rawValue !== undefined && rawValue !== null) {
              cleartext = BigInt(rawValue as bigint);
              decryptionProof = result.decryptionProof as string;
              break;
            }
          }
        } catch {
          // KMS hasn't processed the decryption yet, keep polling
        }
      }

      if (cleartext === undefined || !decryptionProof) {
        throw new Error(
          "KMS decryption timed out. The unwrap request is pending on-chain — " +
            "you can retry finalization later once the KMS proof becomes available.",
        );
      }

      // Step 4: Call finalizeUnwrap with real cleartext and proof
      setStep("finalizing");
      setMessage("Finalizing unwrap on-chain...");

      const finalizeTx = await contract.finalizeUnwrap(burntHandle, cleartext, decryptionProof);
      await finalizeTx.wait();

      setStep("done");
      setMessage("Unwrap complete! USDC received.");
      onComplete?.();
    } catch (e) {
      setStep("error");
      setMessage(`Unwrap failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [canUnwrap, instance, ethersSigner, cUsdcAddress, cUsdcAbi, walletAddress, amount, encryptWith, onComplete]);

  return { canUnwrap, unwrap, isProcessing, step, message };
}
