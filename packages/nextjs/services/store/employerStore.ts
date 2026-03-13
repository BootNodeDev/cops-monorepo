import { create } from "zustand";
import { type PendingEmployee, validateRow } from "~~/utils/cops/csvParser";

type EmployerState = {
  pendingRows: PendingEmployee[];
  addRow: () => void;
  updateRow: (id: string, field: keyof PendingEmployee, value: string) => void;
  removeRow: (id: string) => void;
  setRows: (rows: PendingEmployee[]) => void;
  clearRows: () => void;
  fundAmount: string;
  setFundAmount: (v: string) => void;
};

let rowCounter = 0;

export const useEmployerStore = create<EmployerState>(set => ({
  pendingRows: [],
  addRow: () =>
    set(state => ({
      pendingRows: [
        ...state.pendingRows,
        {
          id: `row-${++rowCounter}-${Date.now()}`,
          address: "",
          name: "",
          role: "",
          monthlySalaryUsdc: "",
        },
      ],
    })),
  updateRow: (id, field, value) =>
    set(state => ({
      pendingRows: state.pendingRows.map(row => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        updated.validationError = validateRow(updated);
        return updated;
      }),
    })),
  removeRow: (id: string) =>
    set(state => ({
      pendingRows: state.pendingRows.filter(row => row.id !== id),
    })),
  setRows: (rows: PendingEmployee[]) => set({ pendingRows: rows }),
  clearRows: () => set({ pendingRows: [] }),
  fundAmount: "",
  setFundAmount: (v: string) => set({ fundAmount: v }),
}));
