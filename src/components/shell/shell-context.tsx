import { router } from "expo-router";
import { create } from "zustand";

interface ShellState {
  quickAddOpen: boolean;
  setQuickAddOpen: (open: boolean) => void;
  /** Opens the Create sheet (add client / record measurements / new order). */
  openQuickAdd: () => void;
  /** Opens global search (clients, orders, actions and pages). */
  openSearch: () => void;
}

export const useShell = create<ShellState>(set => ({
  quickAddOpen: false,
  setQuickAddOpen: open => set({ quickAddOpen: open }),
  openQuickAdd: () => set({ quickAddOpen: true }),
  openSearch: () => router.push("/search"),
}));
