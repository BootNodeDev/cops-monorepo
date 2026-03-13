"use client";

import { useMemo } from "react";
import { useDeployedContractInfo } from "~~/hooks/helper";
import { getContractAddressOverrides } from "~~/utils/cops/contractAddresses";
import type { AllowedChainIds } from "~~/utils/helper/networks";

export function useContractAddresses(chainId: number | undefined) {
  const allowedChainId = chainId as AllowedChainIds | undefined;
  const { data: mockUsdcInfo, isLoading: l1 } = useDeployedContractInfo({
    contractName: "MockUSDC",
    chainId: allowedChainId,
  });
  const { data: cUsdcInfo, isLoading: l2 } = useDeployedContractInfo({
    contractName: "ConfidentialUSDC",
    chainId: allowedChainId,
  });
  const { data: payrollInfo, isLoading: l3 } = useDeployedContractInfo({
    contractName: "ConfidentialPayroll",
    chainId: allowedChainId,
  });

  return useMemo(() => {
    const overrides = getContractAddressOverrides();
    return {
      mockUsdcAddress: (overrides.mockUsdc || mockUsdcInfo?.address) as `0x${string}` | undefined,
      mockUsdcAbi: mockUsdcInfo?.abi,
      cUsdcAddress: (overrides.cUsdc || cUsdcInfo?.address) as `0x${string}` | undefined,
      cUsdcAbi: cUsdcInfo?.abi,
      payrollAddress: (overrides.payroll || payrollInfo?.address) as `0x${string}` | undefined,
      payrollAbi: payrollInfo?.abi,
      isLoading: l1 || l2 || l3,
    };
  }, [mockUsdcInfo, cUsdcInfo, payrollInfo, l1, l2, l3]);
}
