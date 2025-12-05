import { create } from "zustand";
import { combine } from "zustand/middleware";

import type { ToolJson } from "jsonv-ts/mcp";

export const useMcpStore = create(
   combine(
      {
         tools: [] as ToolJson[],
         history: [] as { type: "request" | "response"; data: any }[],
         historyLimit: 50,
         historyVisible: false,
      },
      (set) => ({
         setTools: (tools: ToolJson[]) => set({ tools }),
         addHistory: (type: "request" | "response", data: any) =>
            set((state) => ({
               history: [{ type, data }, ...state.history.slice(0, state.historyLimit - 1)],
            })),
         setHistoryLimit: (limit: number) => set({ historyLimit: limit }),
         setHistoryVisible: (visible: boolean) => set({ historyVisible: visible }),
      }),
   ),
);
