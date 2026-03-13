"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FhevmInstance, useFHEDecrypt, useInMemoryStorage } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Abi } from "viem";
import { useReadContract } from "wagmi";

export function useEmployeeBalance(params: {
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  chainId: number | undefined;
  cUsdcAddress: `0x${string}` | undefined;
  cUsdcAbi: Abi | undefined;
  walletAddress: `0x${string}` | undefined;
}) {
  const { instance, ethersSigner, chainId, cUsdcAddress, cUsdcAbi, walletAddress } = params;
  const { storage } = useInMemoryStorage();
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");

  const balanceResult = useReadContract({
    address: cUsdcAddress,
    abi: cUsdcAbi as any,
    functionName: "confidentialBalanceOf",
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: Boolean(cUsdcAddress && walletAddress) },
  });

  const balanceHandle = (balanceResult.data as string) ?? undefined;

  const requests = useMemo(() => {
    if (!balanceHandle || !cUsdcAddress || balanceHandle === ethers.ZeroHash) return undefined;
    return [{ handle: balanceHandle, contractAddress: cUsdcAddress }] as const;
  }, [balanceHandle, cUsdcAddress]);

  const { decrypt, isDecrypting, results } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage: storage,
    chainId,
    requests,
  });

  const balanceClear = useMemo(() => {
    if (!balanceHandle || !results) return undefined;
    const val = results[balanceHandle];
    return typeof val === "bigint" ? val : undefined;
  }, [balanceHandle, results]);

  // Clear working flag when result arrives
  useEffect(() => {
    if (balanceClear !== undefined) {
      setIsWorking(false);
      setMessage("");
    }
  }, [balanceClear]);

  const decryptBalance = useCallback(async () => {
    if (!decrypt || isWorking) return;
    setIsWorking(true);
    setMessage("Signing decryption request... (wallet popup)");
    await decrypt();
  }, [decrypt, isWorking]);

  return {
    canDecrypt: Boolean(instance && ethersSigner && balanceHandle && balanceHandle !== ethers.ZeroHash && !isWorking),
    decrypt: decryptBalance,
    isDecrypting: isWorking || isDecrypting,
    balanceHandle,
    balanceClear,
    message,
    refetch: useCallback(() => {
      setIsWorking(false);
      balanceResult.refetch();
    }, [balanceResult]),
  };
}
