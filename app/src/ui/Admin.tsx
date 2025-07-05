import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import React, { type ReactNode } from "react";
import { BkndProvider, type BkndAdminOptions } from "ui/client/bknd";
import { useTheme } from "ui/client/use-theme";
import { Logo } from "ui/components/display/Logo";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { ClientProvider, useBkndWindowContext, type ClientProviderProps } from "./client";
import { createMantineTheme } from "./lib/mantine/theme";
import { Routes } from "./routes";

export type BkndAdminProps = {
   baseUrl?: string;
   withProvider?: boolean | ClientProviderProps;
   config?: BkndAdminOptions;
};

export default function Admin({
   baseUrl: baseUrlOverride,
   withProvider = false,
   config: _config = {},
}: BkndAdminProps) {
   const { theme } = useTheme();
   const Provider = ({ children }: any) =>
      withProvider ? (
         <ClientProvider
            baseUrl={baseUrlOverride}
            {...(typeof withProvider === "object" ? withProvider : {})}
         >
            {children}
         </ClientProvider>
      ) : (
         children
      );
   const config = {
      ..._config,
      ...useBkndWindowContext(),
   };

   const BkndWrapper = ({ children }: { children: ReactNode }) => (
      <BkndProvider options={config} fallback={<Skeleton theme={config?.theme} />}>
         {children}
      </BkndProvider>
   );

   return (
      <Provider>
         <MantineProvider {...createMantineTheme(theme as any)}>
            <Notifications position="top-right" />
            <Routes BkndWrapper={BkndWrapper} basePath={config?.basepath} />
         </MantineProvider>
      </Provider>
   );
}

const Skeleton = ({ theme }: { theme?: any }) => {
   const t = useTheme();
   const actualTheme = theme && ["dark", "light"].includes(theme) ? theme : t.theme;

   return (
      <div id="bknd-admin" className={actualTheme + " antialiased"}>
         <AppShell.Root>
            <header
               data-shell="header"
               className="flex flex-row w-full h-16 gap-2.5 border-muted border-b justify-start bg-muted/10"
            >
               <div className="max-h-full flex hover:bg-primary/5 link p-2.5 w-[134px] outline-none">
                  <Logo theme={actualTheme} />
               </div>
               <nav className="hidden md:flex flex-row gap-2.5 pl-0 p-2.5 items-center">
                  {[...new Array(4)].map((item, key) => (
                     <AppShell.NavLink key={key} as="span" className="active h-full opacity-50">
                        <div className="w-18 h-3" />
                     </AppShell.NavLink>
                  ))}
               </nav>
               <nav className="flex md:hidden flex-row gap-2.5 pl-0 p-2.5 items-center">
                  <AppShell.NavLink as="span" className="active h-full opacity-50">
                     <div className="w-20 h-3" />
                  </AppShell.NavLink>
               </nav>
               <div className="flex flex-grow" />
               <div className="hidden lg:flex flex-row items-center px-4 gap-2 opacity-50">
                  <div className="size-11 rounded-full bg-primary/10" />
               </div>
            </header>
            <AppShell.Content>
               <div className="flex flex-col w-full h-full justify-center items-center">
                  {/*<span className="font-mono opacity-30">Loading</span>*/}
               </div>
            </AppShell.Content>
         </AppShell.Root>
      </div>
   );
};
