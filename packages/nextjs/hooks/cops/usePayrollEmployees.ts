"use client";

import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import type { Abi } from "viem";

export type OnChainEmployee = {
  id: number;
  wallet: string;
  name: string;
  role: string;
  active: boolean;
  lastPaidAt: bigint;
};

export function usePayrollEmployees(params: {
  ethersReadonlyProvider: ethers.JsonRpcProvider | ethers.BrowserProvider | undefined;
  payrollAddress: `0x${string}` | undefined;
  payrollAbi: Abi | undefined;
}) {
  const { ethersReadonlyProvider, payrollAddress, payrollAbi } = params;
  const [employees, setEmployees] = useState<OnChainEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEmployees = useCallback(async () => {
    if (!ethersReadonlyProvider || !payrollAddress || !payrollAbi) return;

    setIsLoading(true);
    try {
      const contract = new ethers.Contract(payrollAddress, payrollAbi as ethers.InterfaceAbi, ethersReadonlyProvider);
      const count = await contract.getEmployeeCount();
      const total = Number(count);
      const list: OnChainEmployee[] = [];

      for (let i = 1; i <= total; i++) {
        const [wallet, name, role, active, lastPaidAt] = await contract.getEmployee(i);
        list.push({ id: i, wallet, name, role, active, lastPaidAt: BigInt(lastPaidAt) });
      }

      setEmployees(list);
    } catch (e) {
      console.error("Failed to fetch employees:", e);
    } finally {
      setIsLoading(false);
    }
  }, [ethersReadonlyProvider, payrollAddress, payrollAbi]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return {
    employees,
    employeeCount: employees.length,
    isLoading,
    refetch: fetchEmployees,
  };
}
