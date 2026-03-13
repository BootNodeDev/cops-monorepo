import { type Address } from "viem";

export function getContractAddressOverrides(): {
  mockUsdc: Address | undefined;
  cUsdc: Address | undefined;
  payroll: Address | undefined;
} {
  const parse = (val: string | undefined): Address | undefined => {
    if (!val || val.trim() === "") return undefined;
    return val.trim() as Address;
  };

  return {
    mockUsdc: parse(process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS),
    cUsdc: parse(process.env.NEXT_PUBLIC_CUSDC_ADDRESS),
    payroll: parse(process.env.NEXT_PUBLIC_PAYROLL_ADDRESS),
  };
}
