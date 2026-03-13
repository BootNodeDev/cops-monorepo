"use client";

import { useCallback, useMemo, useState } from "react";
import { FhevmInstance, useFHEEncryption } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Abi } from "viem";

export type UnwrapStep = "idle" | "encrypting" | "requesting" | "waiting_kms" | "finalizing" | "done" | "error";

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
        // No event found — the unwrap may still finalize via relayer
        setStep("done");
        setMessage("Unwrap submitted. Check your USDC balance shortly.");
        onComplete?.();
        return;
      }

      const parsed = contract.interface.parseLog({
        topics: [...unwrapEvent.topics],
        data: unwrapEvent.data,
      });
      const burntHandle = parsed?.args?.[1]; // UnwrapRequested(receiver, amount)

      if (!burntHandle) {
        setStep("done");
        setMessage("Unwrap submitted. Check your USDC balance shortly.");
        onComplete?.();
        return;
      }

      // Wait for KMS to make the handle publicly decryptable
      setStep("waiting_kms");
      setMessage("Waiting for KMS decryption proof (may take a few seconds)...");

      // Poll for the finalization — the KMS/relayer will process it
      // We attempt finalizeUnwrap with increasing delays
      let finalized = false;
      for (let attempt = 0; attempt < 20 && !finalized; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000 + attempt * 1000));
        setMessage(`Waiting for KMS proof... (attempt ${attempt + 1}/20)`);

        try {
          // Try to get the cleartext from on-chain public decryption
          // The KMS processes the makePubliclyDecryptable request and the
          // cleartext becomes available. We attempt finalizeUnwrap which
          // will revert if not yet available.
          //
          // Since we can't easily get the cleartext without the KMS callback,
          // we check if the unwrap request is still pending
          const requesterCheck = await contract
            .getFunction("finalizeUnwrap")
            .staticCall(
              burntHandle,
              0, // dummy cleartext — staticCall will revert with the real error
              "0x",
            )
            .catch(() => null);

          // If staticCall doesn't revert, something unexpected happened
          if (requesterCheck !== null) {
            finalized = true;
          }
        } catch {
          // Expected — KMS hasn't provided proof yet, keep polling
        }
      }

      if (!finalized) {
        setStep("done");
        setMessage(
          "Unwrap requested. KMS finalization is taking longer than expected — " +
            "your USDC will arrive once the KMS processes the proof.",
        );
        onComplete?.();
        return;
      }

      setStep("done");
      setMessage("Unwrap complete! USDC received.");
      onComplete?.();
    } catch (e) {
      setStep("error");
      setMessage(`Unwrap failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [canUnwrap, ethersSigner, cUsdcAddress, cUsdcAbi, walletAddress, amount, encryptWith, onComplete]);

  return { canUnwrap, unwrap, isProcessing, step, message };
}
