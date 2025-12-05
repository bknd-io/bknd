import * as AppShell from "ui/layouts/AppShell/AppShell";
import { useMcpStore } from "./state";
import * as Tools from "./tools";
import { TbWorld } from "react-icons/tb";
import { McpIcon } from "./components/mcp-icon";
import { useBknd } from "ui/client/bknd";
import { Empty } from "ui/components/display/Empty";
import { Button } from "ui/components/buttons/Button";
import { appShellStore } from "ui/store";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import { RoutePathStateProvider } from "ui/hooks/use-route-path-state";
import { Route, Switch } from "wouter";

export default function ToolsMcp() {
   useBrowserTitle(["MCP UI"]);

   const { config } = useBknd();
   const openSidebar = appShellStore((store) => store.toggleSidebar("default"));
   const mcpPath = config.server.mcp.path;

   if (!config.server.mcp.enabled) {
      return (
         <Empty
            title="MCP not enabled"
            description="Please enable MCP in the settings to continue."
         />
      );
   }

   return (
      <RoutePathStateProvider path={"/:type?"} defaultIdentifier="tools">
         <div className="flex flex-col flex-grow max-w-screen">
            <AppShell.SectionHeader>
               <div className="flex flex-row gap-4 items-center">
                  <McpIcon />
                  <AppShell.SectionHeaderTitle className="whitespace-nowrap truncate">
                     MCP UI
                  </AppShell.SectionHeaderTitle>
                  <div className="hidden md:flex flex-row gap-2 items-center bg-primary/5 rounded-full px-3 pr-3.5 py-2">
                     <TbWorld />
                     <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-mono leading-none select-text">
                           {window.location.origin + mcpPath}
                        </span>
                     </div>
                  </div>
               </div>
            </AppShell.SectionHeader>

            <div className="flex grow h-full">
               <AppShell.Sidebar>
                  <Tools.Sidebar />
                  <AppShell.RouteAwareSectionHeaderAccordionItem
                     title="Resources"
                     identifier="resources"
                  >
                     <div className="flex flex-col flex-grow p-3 gap-3 justify-center items-center opacity-40">
                        <i>Resources</i>
                     </div>
                  </AppShell.RouteAwareSectionHeaderAccordionItem>
               </AppShell.Sidebar>

               <Switch>
                  <Route path="/tools/:toolName?" component={Tools.Content} />
                  <Route path="*">
                     <Empty
                        title="No tool selected"
                        description="Please select a tool to continue."
                     >
                        <Button
                           variant="primary"
                           onClick={() => openSidebar()}
                           className="block md:hidden"
                        >
                           Open Tools
                        </Button>
                     </Empty>
                  </Route>
               </Switch>
            </div>
         </div>
      </RoutePathStateProvider>
   );
}
