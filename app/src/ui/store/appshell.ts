import { create } from "zustand";
import { combine, persist } from "zustand/middleware";

type SidebarState = {
   open: boolean;
   width: number;
};

export const appShellStore = create(
   persist(
      combine(
         {
            sidebars: {
               default: {
                  open: false,
                  width: 350,
               },
            } as Record<string, SidebarState>,
         },
         (set) => ({
            toggleSidebar: (name: string) => () =>
               set((state) => {
                  const sidebar = state.sidebars[name];
                  if (!sidebar) return state;
                  return {
                     sidebars: {
                        ...state.sidebars,
                        [name]: { ...sidebar, open: !sidebar.open },
                     },
                  };
               }),
            closeSidebar: (name: string) => () =>
               set((state) => {
                  const sidebar = state.sidebars[name];
                  if (!sidebar) return state;
                  return {
                     sidebars: { ...state.sidebars, [name]: { ...sidebar, open: false } },
                  };
               }),
            setSidebarWidth: (name: string) => (width: number) =>
               set((state) => {
                  const sidebar = state.sidebars[name];
                  if (!sidebar)
                     return { sidebars: { ...state.sidebars, [name]: { open: false, width } } };
                  return { sidebars: { ...state.sidebars, [name]: { ...sidebar, width } } };
               }),
            resetSidebarWidth: (name: string) =>
               set((state) => {
                  const sidebar = state.sidebars[name];
                  if (!sidebar) return state;
                  return { sidebars: { ...state.sidebars, [name]: { ...sidebar, width: 350 } } };
               }),

            setSidebarState: (name: string, update: SidebarState) =>
               set((state) => ({ sidebars: { ...state.sidebars, [name]: update } })),
         }),
      ),
      {
         name: "appshell",
         version: 1,
         migrate: () => {
            return {
               sidebars: {
                  default: {
                     open: false,
                     width: 350,
                  },
               },
            };
         },
      },
   ),
);
