"use client";
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { demoReducer, initialDemoState, type DemoAction } from "@/lib/purchase-demo";
import type { DemoState } from "@/lib/api/types";

const DemoOrderContext = createContext<{ state: DemoState; dispatch: Dispatch<DemoAction> } | null>(null);
/** Session memory only. No wallet, persistence or execution endpoint. */
export function DemoOrderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, initialDemoState);
  return <DemoOrderContext.Provider value={{ state, dispatch }}>{children}</DemoOrderContext.Provider>;
}
export function useDemoOrder() {
  const context = useContext(DemoOrderContext);
  if (!context) throw new Error("DemoOrderProvider is required.");
  return context;
}
