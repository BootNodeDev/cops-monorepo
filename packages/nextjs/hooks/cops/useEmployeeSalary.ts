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
  const [isFetchingHandle, setIsFetchingHandle] = useState(false);
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

  const fetchAndDecrypt = useCallback(async () => {
    if (!ethersSigner || !payrollAddress || !payrollAbi || !employeeId) return;

    setIsFetchingHandle(true);
    setMessage("Fetching salary handle...");
    try {
      const contract = new ethers.Contract(payrollAddress, payrollAbi as ethers.InterfaceAbi, ethersSigner);
      const handle = await contract.getSalary.staticCall(employeeId);
      setSalaryHandle(handle as string);
      setMessage("Decrypting salary...");
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsFetchingHandle(false);
    }
  }, [ethersSigner, payrollAddress, payrollAbi, employeeId]);

  useEffect(() => {
    if (salaryHandle && !salaryClear && decrypt) {
      decrypt();
    }
  }, [salaryHandle, salaryClear, decrypt]);

  useEffect(() => {
    if (salaryClear !== undefined) setMessage("");
  }, [salaryClear]);

  return {
    canDecrypt: Boolean(instance && ethersSigner && payrollAddress && employeeId && !isFetchingHandle && !isDecrypting),
    decrypt: fetchAndDecrypt,
    isDecrypting: isFetchingHandle || isDecrypting,
    salaryHandle,
    salaryClear,
    message,
  };
}
