import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import React, { type ReactNode } from "react";
import { BkndProvider } from "ui/client/bknd";
import { useTheme, type AppTheme } from "ui/client/use-theme";
import { Logo } from "ui/components/display/Logo";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { ClientProvider, useBkndWindowContext, type ClientProviderProps } from "bknd/client";
import { createMantineTheme } from "./lib/mantine/theme";
import { Routes } from "./routes";
import type { BkndAdminAppShellOptions, BkndAdminEntitiesOptions } from "./options";

export type BkndAdminConfig = {
   /**
    * Base path of the Admin UI
    * @default `/`
    */
   basepath?: string;
   /**
    * Path to return to when clicking the logo
    * @default `/`
    */
   logo_return_path?: string;
   /**
    * Theme of the Admin UI
    * @default `system`
    */
   theme?: AppTheme;
   /**
    * Entities configuration like headers, footers, actions, field renders, etc.
    */
   entities?: BkndAdminEntitiesOptions;
   /**
    * App shell configuration like user menu actions.
    */
   appShell?: BkndAdminAppShellOptions;
};

export type BkndAdminProps = {
   /**
    * Base URL of the API, only needed if you are not using the `withProvider` prop
    */
   baseUrl?: string;
   /**
    * Whether to wrap Admin in a `<ClientProvider />`
    */
   withProvider?: boolean | ClientProviderProps;
   /**
    * Admin UI customization options
    */
   config?: BkndAdminConfig;
   children?: ReactNode;
};

export default function Admin(props: BkndAdminProps) {
   const Provider = ({ children }: any) =>
      props.withProvider ? (
         <ClientProvider
            baseUrl={props.baseUrl}
            {...(typeof props.withProvider === "object" ? props.withProvider : {})}
         >
            {children}
         </ClientProvider>
      ) : (
         children
      );

   return (
      <Provider>
         <AdminInner {...props} />
      </Provider>
   );
}

function AdminInner(props: BkndAdminProps) {
   const { theme } = useTheme();
   const config = {
      ...props.config,
      ...useBkndWindowContext(),
   };

   const BkndWrapper = ({ children }: { children: ReactNode }) => (
      <BkndProvider options={config} fallback={<Skeleton theme={config?.theme} />}>
         {children}
      </BkndProvider>
   );

   return (
      <MantineProvider {...createMantineTheme(theme as any)}>
         <Notifications position="top-right" />
         <Routes BkndWrapper={BkndWrapper} basePath={config?.basepath}>
            {props.children}
         </Routes>
      </MantineProvider>
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
