import { create } from "zustand";
import { combine, persist } from "zustand/middleware";

export type CanvasPosition = {
   id: string;
   x: number;
   y: number;
};

export const dataCanvasStore = create(
   persist(
      combine(
         {
            positions: null as CanvasPosition[] | null,
         },
         (set) => ({
            setPositions: (positions: CanvasPosition[]) => set(() => ({ positions })),
            reset: () => set(() => ({ positions: null })),
         }),
      ),
      {
         name: "datacanvas",
      },
   ),
);
