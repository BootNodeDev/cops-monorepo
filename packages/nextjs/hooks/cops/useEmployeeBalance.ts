"use client";

import { useCallback, useState } from "react";
import { FhevmDecryptionSignature, useInMemoryStorage } from "@fhevm-sdk";
import type { FhevmInstance } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Abi } from "viem";
import { useReadContract } from "wagmi";

const DECRYPT_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(
      v => {
        clearTimeout(timer);
        resolve(v);
      },
      e => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function useEmployeeBalance(params: {
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  cUsdcAddress: `0x${string}` | undefined;
  cUsdcAbi: Abi | undefined;
  walletAddress: `0x${string}` | undefined;
}) {
  const { instance, ethersSigner, cUsdcAddress, cUsdcAbi, walletAddress } = params;
  const { storage } = useInMemoryStorage();

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [balanceClear, setBalanceClear] = useState<bigint | undefined>();
  const [message, setMessage] = useState("");

  const balanceResult = useReadContract({
    address: cUsdcAddress,
    abi: cUsdcAbi as any,
    functionName: "confidentialBalanceOf",
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: Boolean(cUsdcAddress && walletAddress) },
  });

  const balanceHandle = (balanceResult.data as string) ?? undefined;

  const decrypt = useCallback(async () => {
    if (!instance || !ethersSigner || !cUsdcAddress || !balanceHandle) return;
    if (balanceHandle === ethers.ZeroHash) return;
    if (isDecrypting) return;

    setIsDecrypting(true);
    setMessage("Signing decryption request... (wallet popup)");

    try {
      const sig = await FhevmDecryptionSignature.loadOrSign(instance, [cUsdcAddress], ethersSigner, storage);

      if (!sig) {
        setMessage("Signature rejected");
        return;
      }

      setMessage("Decrypting (can take 30-60s)...");

      const requests = [{ handle: balanceHandle, contractAddress: cUsdcAddress }];
      const results = await withTimeout(
        instance.userDecrypt(
          requests,
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays,
        ),
        DECRYPT_TIMEOUT_MS,
        "userDecrypt",
      );

      const value = results[balanceHandle as `0x${string}`];
      if (typeof value === "bigint") {
        setBalanceClear(value);
        setMessage("");
      } else {
        setMessage("Unexpected decryption result");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const rejected =
        msg.includes("ACTION_REJECTED") ||
        msg.includes("rejected") ||
        msg.includes("denied") ||
        msg.includes("user rejected");
      if (rejected) {
        setMessage("Signature rejected");
      } else if (msg.includes("not authorized")) {
        setMessage("ACL: wallet not authorized to decrypt this handle");
      } else if (msg.includes("timed out")) {
        setMessage("Relayer timeout — try again in a few minutes");
      } else {
        setMessage(`Decryption failed: ${msg}`);
      }
    } finally {
      setIsDecrypting(false);
    }
  }, [instance, ethersSigner, cUsdcAddress, balanceHandle, isDecrypting, storage]);

  return {
    canDecrypt: Boolean(
      instance && ethersSigner && balanceHandle && balanceHandle !== ethers.ZeroHash && !isDecrypting,
    ),
    decrypt,
    isDecrypting,
    balanceHandle,
    balanceClear,
    message,
    refetch: useCallback(() => {
      setBalanceClear(undefined);
      setMessage("");
      balanceResult.refetch();
    }, [balanceResult]),
  };
}
