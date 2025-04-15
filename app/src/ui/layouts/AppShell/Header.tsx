import { SegmentedControl, Tooltip } from "@mantine/core";
import { IconKeyOff, IconSettings, IconUser } from "@tabler/icons-react";
import {
   TbDatabase,
   TbFingerprint,
   TbHierarchy2,
   TbMenu2,
   TbPhoto,
   TbSelector,
   TbUser,
   TbX,
} from "react-icons/tb";
import { useAuth, useBkndWindowContext } from "ui/client";
import { useBknd } from "ui/client/bknd";
import { useTheme } from "ui/client/use-theme";
import { Button } from "ui/components/buttons/Button";
import { IconButton } from "ui/components/buttons/IconButton";
import { Logo } from "ui/components/display/Logo";
import { Dropdown, type DropdownItem } from "ui/components/overlay/Dropdown";
import { Link } from "ui/components/wouter/Link";
import { useEvent } from "ui/hooks/use-event";
import { useNavigate } from "ui/lib/routes";
import { useLocation } from "wouter";
import { NavLink } from "./AppShell";
import { autoFormatString } from "core/utils";
import { appShellStore } from "ui/store";

export function HeaderNavigation() {
   const [location, navigate] = useLocation();

   const items: {
      label: string;
      href: string;
      Icon: any;
      exact?: boolean;
      tooltip?: string;
      disabled?: boolean;
   }[] = [
      /*{
         label: "Base",
         href: "#",
         exact: true,
         Icon: TbLayoutDashboard,
         disabled: true,
         tooltip: "Coming soon"
      },*/
      { label: "Data", href: "/data", Icon: TbDatabase },
      { label: "Auth", href: "/auth", Icon: TbFingerprint },
      { label: "Media", href: "/media", Icon: TbPhoto },
      { label: "Flows", href: "/flows", Icon: TbHierarchy2 },
   ];
   const activeItem = items.find((item) =>
      item.exact ? location === item.href : location.startsWith(item.href),
   );

   const handleItemClick = useEvent((item) => {
      navigate(item.href);
   });

   const renderDropdownItem = (item, { key, onClick }) => (
      <NavLink key={key} onClick={onClick} as="button" className="rounded-md">
         <div
            data-active={activeItem?.label === item.label}
            className="flex flex-row items-center gap-2.5 data-[active=true]:opacity-50"
         >
            <item.Icon size={18} />
            <span className="text-lg">{item.label}</span>
         </div>
      </NavLink>
   );

   return (
      <>
         <nav className="hidden md:flex flex-row gap-2.5 pl-0 p-2.5 items-center">
            {items.map((item) => (
               <NavLink
                  key={item.href}
                  as={Link}
                  href={item.href}
                  Icon={item.Icon}
                  disabled={item.disabled}
               >
                  {item.label}
               </NavLink>
            ))}
         </nav>
         <nav className="flex md:hidden flex-row items-center">
            {activeItem && (
               <Dropdown
                  items={items}
                  onClickItem={handleItemClick}
                  renderItem={renderDropdownItem}
               >
                  <NavLink as="button" Icon={activeItem.Icon} className="active pl-6 pr-3.5">
                     <div className="flex flex-row gap-2 items-center">
                        <span className="text-lg">{activeItem.label}</span>
                        <TbSelector size={18} className="opacity-70" />
                     </div>
                  </NavLink>
               </Dropdown>
            )}
         </nav>
      </>
   );
}

function SidebarToggler() {
   const toggle = appShellStore((store) => store.toggleSidebar);
   const open = appShellStore((store) => store.sidebarOpen);
   return <IconButton id="toggle-sidebar" size="lg" Icon={open ? TbX : TbMenu2} onClick={toggle} />;
}

export function Header({ hasSidebar = true }) {
   const { app } = useBknd();
   const { theme } = useTheme();
   const { logo_return_path = "/" } = app.options;

   return (
      <header
         id="header"
         data-shell="header"
         className="flex flex-row w-full h-16 gap-2.5 border-muted border-b justify-start bg-muted/10"
      >
         <Link
            href={logo_return_path}
            native={logo_return_path !== "/"}
            className="max-h-full flex hover:bg-primary/5 link p-2.5 w-[134px] outline-none"
         >
            <Logo theme={theme} />
         </Link>
         <HeaderNavigation />
         <div className="flex flex-grow" />
         <div className="flex md:hidden flex-row items-center pr-2 gap-2">
            <SidebarToggler />
            <UserMenu />
         </div>
         <div className="hidden md:flex flex-row items-center px-4 gap-2">
            <UserMenu />
         </div>
      </header>
   );
}

function UserMenu() {
   const { config, options } = useBknd();
   const auth = useAuth();
   const [navigate] = useNavigate();
   const { logout_route } = useBkndWindowContext();

   async function handleLogout() {
      await auth.logout();
      // @todo: grab from somewhere constant
      navigate(logout_route, { reload: true });
   }

   async function handleLogin() {
      navigate("/auth/login");
   }

   const items: DropdownItem[] = [
      { label: "Settings", onClick: () => navigate("/settings"), icon: IconSettings },
   ];

   if (config.auth.enabled) {
      if (!auth.user) {
         items.push({ label: "Login", onClick: handleLogin, icon: IconUser });
      } else {
         items.push({
            label: `Logout ${auth.user.email}`,
            onClick: handleLogout,
            icon: IconKeyOff,
         });
      }
   }

   if (!options.theme) {
      items.push(() => <UserMenuThemeToggler />);
   }

   return (
      <>
         <Dropdown items={items} position="bottom-end">
            {auth.user ? (
               <Button className="rounded-full w-12 h-12 justify-center p-0 text-lg">
                  {auth.user.email[0]?.toUpperCase()}
               </Button>
            ) : (
               <Button className="rounded-full w-12 h-12 justify-center p-0" IconLeft={TbUser} />
            )}
         </Dropdown>
      </>
   );
}

function UserMenuThemeToggler() {
   const { value, themes, setTheme } = useTheme();
   return (
      <div className="flex flex-col items-center mt-1 pt-1 border-t border-primary/5">
         <SegmentedControl
            withItemsBorders={false}
            className="w-full"
            data={themes.map((t) => ({ value: t, label: autoFormatString(t) }))}
            value={value}
            onChange={setTheme}
            size="xs"
         />
      </div>
   );
}
