"use client";

import { useCallback, useState } from "react";
import { FhevmDecryptionSignature, useInMemoryStorage } from "@fhevm-sdk";
import type { FhevmInstance } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Abi } from "viem";

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

export function useEmployeeSalary(params: {
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  payrollAddress: `0x${string}` | undefined;
  payrollAbi: Abi | undefined;
}) {
  const { instance, ethersSigner, payrollAddress, payrollAbi } = params;
  const { storage } = useInMemoryStorage();

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [salaryClear, setSalaryClear] = useState<bigint | undefined>();
  const [salaryHandle, setSalaryHandle] = useState<string | undefined>();
  const [message, setMessage] = useState("");

  const decrypt = useCallback(
    async (employeeId: number) => {
      if (!instance || !ethersSigner || !payrollAddress || !payrollAbi) return;
      if (isDecrypting) return;

      setIsDecrypting(true);
      setMessage("Fetching salary handle...");

      try {
        const contract = new ethers.Contract(payrollAddress, payrollAbi as ethers.InterfaceAbi, ethersSigner);
        const handle: string = await contract.getSalary.staticCall(employeeId);

        if (!handle || handle === ethers.ZeroHash) {
          setMessage("No salary data found");
          return;
        }

        setSalaryHandle(handle);
        setMessage("Signing decryption request...");

        const sig = await FhevmDecryptionSignature.loadOrSign(instance, [payrollAddress], ethersSigner, storage);

        if (!sig) {
          setMessage("Signature rejected");
          return;
        }

        setMessage("Decrypting via relayer (can take 30-60s)...");

        const requests = [{ handle, contractAddress: payrollAddress }];

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

        const value = results[handle as `0x${string}`];
        if (typeof value === "bigint") {
          setSalaryClear(value);
          setMessage("");
          return value;
        }

        for (const key of Object.keys(results)) {
          const v = results[key as `0x${string}`];
          if (typeof v === "bigint") {
            setSalaryClear(v);
            setMessage("");
            return v;
          }
        }

        setMessage("Unexpected decryption result");
        return undefined;
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
          return "denied" as const;
        } else if (msg.includes("timed out")) {
          setMessage("Relayer timeout — try again in a few minutes");
        } else {
          setMessage(`Decryption failed: ${msg}`);
        }
        return undefined;
      } finally {
        setIsDecrypting(false);
      }
    },
    [instance, ethersSigner, payrollAddress, payrollAbi, isDecrypting, storage],
  );

  return {
    canDecrypt: Boolean(instance && ethersSigner && payrollAddress && payrollAbi && !isDecrypting),
    decrypt,
    isDecrypting,
    salaryHandle,
    salaryClear,
    message,
  };
}
