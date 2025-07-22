import { IconHierarchy2 } from "@tabler/icons-react";
import { isDebug } from "core/env";
import { TbSettings } from "react-icons/tb";
import { useBknd } from "../../client/BkndProvider";
import { IconButton } from "../../components/buttons/IconButton";
import { Empty } from "../../components/display/Empty";
import { Link } from "../../components/wouter/Link";
import { useBrowserTitle } from "../../hooks/use-browser-title";
import * as AppShell from "../../layouts/AppShell/AppShell";
import { routes } from "../../lib/routes";

const ComingSoon = () => (
   <span className="text-xs bg-primary/10 flex rounded-full px-2.5 py-1 leading-none">
      coming soon
   </span>
);

export function FlowsRoot(props) {
   const debug = isDebug();
   //const debug = false;
   return debug ? <FlowsActual {...props} /> : <FlowsEmpty />;
}

export function FlowsActual({ children }) {
   const { app } = useBknd();
   return (
      <>
         <AppShell.Sidebar>
            <AppShell.SectionHeader
               right={
                  <Link href={app.getSettingsPath(["flows"])}>
                     <IconButton Icon={TbSettings} />
                  </Link>
               }
            >
               Flows
            </AppShell.SectionHeader>
            <AppShell.Scrollable initialOffset={96}>
               <div className="flex flex-col flex-grow p-3 gap-3">
                  <nav className="flex flex-col flex-1 gap-1">
                     <AppShell.SidebarLink as={Link} href={routes.flows.flows.list()}>
                        All Flows
                     </AppShell.SidebarLink>
                     <AppShell.SidebarLink disabled className="justify-between">
                        Endpoints
                        <ComingSoon />
                     </AppShell.SidebarLink>
                     <AppShell.SidebarLink disabled className="justify-between">
                        Executions
                        <ComingSoon />
                     </AppShell.SidebarLink>
                     <AppShell.SidebarLink as={Link} href={app.getSettingsPath(["flows"])}>
                        Settings
                     </AppShell.SidebarLink>
                  </nav>
               </div>
            </AppShell.Scrollable>
         </AppShell.Sidebar>
         <AppShell.Main>{children}</AppShell.Main>
      </>
   );
}

export function FlowsEmpty() {
   useBrowserTitle(["Flows"]);
   return <Empty Icon={IconHierarchy2} title="Flows" description="Flows are coming very soon!" />;
}
