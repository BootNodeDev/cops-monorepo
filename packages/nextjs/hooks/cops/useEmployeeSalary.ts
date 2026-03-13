"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FhevmInstance, useFHEDecrypt, useInMemoryStorage } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Abi } from "viem";

export function useEmployeeSalary(params: {
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  chainId: number | undefined;
  payrollAddress: `0x${string}` | undefined;
  payrollAbi: Abi | undefined;
  employeeId: number | undefined;
}) {
  const { instance, ethersSigner, chainId, payrollAddress, payrollAbi, employeeId } = params;
  const { storage } = useInMemoryStorage();
  const [salaryHandle, setSalaryHandle] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");

  const requests = useMemo(() => {
    if (!salaryHandle || !payrollAddress || salaryHandle === ethers.ZeroHash) return undefined;
    return [{ handle: salaryHandle, contractAddress: payrollAddress }] as const;
  }, [salaryHandle, payrollAddress]);

  const { decrypt, isDecrypting, results } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage: storage,
    chainId,
    requests,
  });

  const salaryClear = useMemo(() => {
    if (!salaryHandle || !results) return undefined;
    const val = results[salaryHandle];
    return typeof val === "bigint" ? val : undefined;
  }, [salaryHandle, results]);

  // Clear working flag when we get the result
  useEffect(() => {
    if (salaryClear !== undefined) {
      setIsWorking(false);
      setMessage("");
    }
  }, [salaryClear]);

  // Trigger decrypt when handle is ready
  useEffect(() => {
    if (salaryHandle && !salaryClear && decrypt && isWorking) {
      setMessage("Signing decryption request... (wallet popup)");
      decrypt();
    }
  }, [salaryHandle, salaryClear, decrypt, isWorking]);

  const fetchAndDecrypt = useCallback(async () => {
    if (!ethersSigner || !payrollAddress || !payrollAbi || !employeeId) return;
    if (isWorking) return;

    setIsWorking(true);
    setMessage("Fetching salary handle...");
    try {
      const contract = new ethers.Contract(payrollAddress, payrollAbi as ethers.InterfaceAbi, ethersSigner);
      const handle = await contract.getSalary.staticCall(employeeId);
      setSalaryHandle(handle as string);
      setMessage("Preparing decryption...");
    } catch (e) {
      setIsWorking(false);
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [ethersSigner, payrollAddress, payrollAbi, employeeId, isWorking]);

  return {
    canDecrypt: Boolean(instance && ethersSigner && payrollAddress && employeeId && !isWorking),
    decrypt: fetchAndDecrypt,
    isDecrypting: isWorking || isDecrypting,
    salaryHandle,
    salaryClear,
    message,
  };
}
