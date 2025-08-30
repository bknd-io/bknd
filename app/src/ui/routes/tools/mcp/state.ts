import { create } from "zustand";
import { combine } from "zustand/middleware";

import type { ToolJson } from "jsonv-ts/mcp";

const FEATURES = ["tools", "resources"] as const;
export type Feature = (typeof FEATURES)[number];

export const useMcpStore = create(
   combine(
      {
         tools: [] as ToolJson[],
         feature: "tools" as Feature | null,
         content: null as ToolJson | null,
         history: [] as { type: "request" | "response"; data: any }[],
         historyLimit: 50,
         historyVisible: false,
      },
      (set) => ({
         setTools: (tools: ToolJson[]) => set({ tools }),
         setFeature: (feature: Feature) => set({ feature }),
         setContent: (content: ToolJson | null) => set({ content }),
         addHistory: (type: "request" | "response", data: any) =>
            set((state) => ({
               history: [{ type, data }, ...state.history.slice(0, state.historyLimit - 1)],
            })),
         setHistoryLimit: (limit: number) => set({ historyLimit: limit }),
         setHistoryVisible: (visible: boolean) => set({ historyVisible: visible }),
      }),
   ),
);
