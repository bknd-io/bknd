import { TbSettings } from "react-icons/tb";
import { useBknd } from "ui/client/BkndProvider";
import { IconButton } from "ui/components/buttons/IconButton";
import { Icon } from "ui/components/display/Icon";
import { Link } from "ui/components/wouter/Link";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import * as AppShell from "ui/layouts/AppShell/AppShell";

export function MediaRoot({ children }) {
   const { app, config } = useBknd();
   const mediaDisabled = !config.media.enabled;
   useBrowserTitle(["Media"]);

   return (
      <>
         <AppShell.Sidebar>
            <AppShell.SectionHeader
               right={
                  <Link href={app.getSettingsPath(["media"])}>
                     <IconButton Icon={TbSettings} />
                  </Link>
               }
            >
               Media
            </AppShell.SectionHeader>
            <AppShell.Scrollable initialOffset={96}>
               <div className="flex flex-col flex-grow p-3 gap-3">
                  <nav className="flex flex-col flex-1 gap-1">
                     <AppShell.SidebarLink
                        as={Link}
                        href={"/"}
                        className="flex flex-row justify-between"
                     >
                        Main Bucket{" "}
                        {mediaDisabled && (
                           <Icon.Warning title="Media not enabled." className="size-5" />
                        )}
                     </AppShell.SidebarLink>
                     <AppShell.SidebarLink as={Link} href={"/settings"}>
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
