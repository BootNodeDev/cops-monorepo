import Papa from "papaparse";
import { isAddress } from "viem";

export type CsvRow = {
  address: string;
  name: string;
  role: string;
  monthly_usdc: string;
};

export type PendingEmployee = {
  id: string;
  address: string;
  name: string;
  role: string;
  monthlySalaryUsdc: string;
  validationError?: string;
};

export function parseCsvFile(file: File): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err),
    });
  });
}

export function validateRow(row: PendingEmployee): string | undefined {
  if (!row.address || !isAddress(row.address)) return "Invalid address";
  if (!row.name.trim()) return "Name required";
  if (!row.role.trim()) return "Role required";
  const salary = Number(row.monthlySalaryUsdc);
  if (isNaN(salary) || salary <= 0) return "Invalid salary";
  return undefined;
}

export function toPendingEmployees(rows: CsvRow[]): PendingEmployee[] {
  return rows.map((row, i) => {
    const pending: PendingEmployee = {
      id: `csv-${i}-${Date.now()}`,
      address: row.address?.trim() || "",
      name: row.name?.trim() || "",
      role: row.role?.trim() || "",
      monthlySalaryUsdc: row.monthly_usdc?.trim() || "",
    };
    pending.validationError = validateRow(pending);
    return pending;
  });
}

export function toCsvString(employees: Array<{ wallet: string; name: string; role: string; salary?: string }>): string {
  const rows = employees.map(e => ({
    address: e.wallet,
    name: e.name,
    role: e.role,
    monthly_usdc: e.salary || "",
  }));
  return Papa.unparse(rows);
}
