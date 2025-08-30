import { useClickOutside, useHotkeys } from "@mantine/hooks";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { clampNumber } from "core/utils/numbers";
import { throttle } from "lodash-es";
import { ScrollArea } from "radix-ui";
import {
   type ComponentProps,
   type ComponentPropsWithoutRef,
   useEffect,
   useRef,
   useState,
} from "react";
import type { IconType } from "react-icons";
import { twMerge } from "tailwind-merge";
import { IconButton } from "ui/components/buttons/IconButton";
import { useRoutePathState } from "ui/hooks/use-route-path-state";
import { AppShellProvider, useAppShell } from "ui/layouts/AppShell/use-appshell";
import { appShellStore } from "ui/store";
import { useLocation } from "wouter";

export function Root({ children }: { children: React.ReactNode }) {
   return (
      <AppShellProvider>
         <div id="app-shell" data-shell="root" className="flex flex-1 flex-col select-none h-dvh">
            {children}
         </div>
      </AppShellProvider>
   );
}

type NavLinkProps<E extends React.ElementType> = {
   Icon?: IconType;
   children: React.ReactNode;
   className?: string;
   to?: string; // @todo: workaround
   as?: E;
   disabled?: boolean;
};

export const NavLink = <E extends React.ElementType = "a">({
   children,
   as,
   className,
   Icon,
   disabled,
   ...otherProps
}: NavLinkProps<E> & Omit<React.ComponentProps<E>, keyof NavLinkProps<E>>) => {
   const Tag = as || "a";

   return (
      <Tag
         {...otherProps}
         className={twMerge(
            "px-6 py-2 [&.active]:bg-muted [&.active]:hover:bg-primary/15 hover:bg-primary/5 flex flex-row items-center rounded-full gap-2.5 link transition-colors",
            disabled && "opacity-50 cursor-not-allowed",
            className,
         )}
      >
         {Icon && <Icon size={18} />}
         {typeof children === "string" ? <span className="text-lg">{children}</span> : children}
      </Tag>
   );
};

export function Content({ children, center }: { children: React.ReactNode; center?: boolean }) {
   return (
      <main
         data-shell="content"
         className={twMerge(
            "flex flex-1 flex-row max-w-screen h-full",
            center && "justify-center items-center",
         )}
      >
         {children}
      </main>
   );
}

export function Main({ children }) {
   const { sidebar } = useAppShell();
   return (
      <div
         data-shell="main"
         className={twMerge(
            "flex flex-col flex-grow w-1 flex-shrink-1",
            sidebar.open && "md:max-w-[calc(100%-var(--sidebar-width))]",
         )}
      >
         {children}
      </div>
   );
}

export function Sidebar({
   children,
   name = "default",
   handle = "right",
   minWidth,
   maxWidth,
}: {
   children: React.ReactNode;
   name?: string;
   handle?: "right" | "left";
   minWidth?: number;
   maxWidth?: number;
}) {
   const open = appShellStore((store) => store.sidebars[name]?.open);
   const close = appShellStore((store) => store.closeSidebar(name));
   const width = appShellStore((store) => store.sidebars[name]?.width ?? 350);
   const ref = useClickOutside(close, ["mouseup", "touchend"]); //, [document.getElementById("header")]);
   const sidebarRef = useRef<HTMLDivElement>(null!);
   const [location] = useLocation();

   const closeHandler = () => {
      open && close();
   };

   // listen for window location change
   useEffect(closeHandler, [location]);

   // @todo: potentially has to be added to the root, as modals could be opened
   useHotkeys([["Escape", closeHandler]]);

   return (
      <>
         {handle === "left" && (
            <SidebarResize
               name={name}
               handle={handle}
               sidebarRef={sidebarRef}
               minWidth={minWidth}
               maxWidth={maxWidth}
            />
         )}
         <aside
            data-shell="sidebar"
            ref={sidebarRef}
            className="hidden md:flex flex-col flex-shrink-0 flex-grow-0 h-full bg-muted/10"
            style={{ width }}
         >
            {children}
         </aside>
         {handle === "right" && (
            <SidebarResize
               name={name}
               handle={handle}
               sidebarRef={sidebarRef}
               minWidth={minWidth}
               maxWidth={maxWidth}
            />
         )}
         <div
            data-open={open}
            className="absolute w-full md:hidden data-[open=true]:translate-x-0 translate-x-[-100%] transition-transform z-10 backdrop-blur-sm max-w-[90%]"
         >
            <aside
               ref={ref}
               data-shell="sidebar"
               className="flex-col w-[var(--sidebar-width)] flex-shrink-0 flex-grow-0 h-full border-muted border-r bg-background"
            >
               <MaxHeightContainer className="overflow-y-scroll md:overflow-y-hidden">
                  {children}
               </MaxHeightContainer>
            </aside>
         </div>
      </>
   );
}

const SidebarResize = ({
   name = "default",
   handle = "right",
   sidebarRef,
   minWidth = 250,
   maxWidth = window.innerWidth * 0.5,
}: {
   name?: string;
   handle?: "right" | "left";
   sidebarRef: React.RefObject<HTMLDivElement>;
   minWidth?: number;
   maxWidth?: number;
}) => {
   const setSidebarWidth = appShellStore((store) => store.setSidebarWidth(name));
   const [isResizing, setIsResizing] = useState(false);
   const [start, setStart] = useState(0);
   const [startWidth, setStartWidth] = useState(sidebarRef.current?.offsetWidth ?? 0);

   const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      setStart(e.clientX);
      setStartWidth(sidebarRef.current?.offsetWidth ?? 0);
   };

   const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const diff = handle === "right" ? e.clientX - start : start - e.clientX;
      const newWidth = clampNumber(startWidth + diff, minWidth, maxWidth);
      setSidebarWidth(newWidth);
   };

   const handleMouseUp = () => {
      setIsResizing(false);
   };

   useEffect(() => {
      if (isResizing) {
         window.addEventListener("mousemove", handleMouseMove);
         window.addEventListener("mouseup", handleMouseUp);
      }

      return () => {
         window.removeEventListener("mousemove", handleMouseMove);
         window.removeEventListener("mouseup", handleMouseUp);
      };
   }, [isResizing, start, startWidth, minWidth, maxWidth]);

   return (
      <div
         data-shell="sidebar-resize"
         data-active={isResizing ? 1 : undefined}
         className="w-px h-full hidden md:flex bg-muted after:transition-colors relative after:absolute after:inset-0 after:-left-px after:w-[2px] select-none data-[active]:after:bg-sky-400 data-[active]:cursor-col-resize hover:after:bg-sky-400 hover:cursor-col-resize after:z-2"
         onMouseDown={handleMouseDown}
         style={{ touchAction: "none" }}
      />
   );
};

export function SectionHeaderTitle({ children, className, ...props }: ComponentProps<"h2">) {
   return (
      <h2
         {...props}
         className={twMerge("text-lg dark:font-bold font-semibold select-text", className)}
      >
         {children}
      </h2>
   );
}

export function SectionHeader({ children, right, className, scrollable, sticky }: any = {}) {
   return (
      <div
         className={twMerge(
            "flex flex-row h-14 flex-shrink-0 py-2 pl-5 pr-3 border-muted border-b items-center justify-between bg-muted/10",
            sticky && "sticky top-0 bottom-10 z-10",
            className,
         )}
      >
         <div
            className={twMerge(
               "",
               scrollable && "overflow-x-scroll overflow-y-visible app-scrollbar",
            )}
         >
            {typeof children === "string" ? (
               <SectionHeaderTitle>{children}</SectionHeaderTitle>
            ) : (
               children
            )}
         </div>
         {right && !scrollable && <div className="flex flex-row gap-2.5">{right}</div>}
         {right && scrollable && (
            <div className="flex flex-row sticky z-10 right-0 h-full">
               <div className="h-full w-5 bg-gradient-to-l from-background" />
               <div className="flex flex-row gap-2.5 bg-background">{right}</div>
            </div>
         )}
      </div>
   );
}

type SidebarLinkProps<E extends React.ElementType> = {
   children: React.ReactNode;
   as?: E;
   to?: string; // @todo: workaround
   params?: Record<string, string>; // @todo: workaround
   disabled?: boolean;
};

export const SidebarLink = <E extends React.ElementType = "a">({
   children,
   as,
   className,
   disabled = false,
   ...otherProps
}: SidebarLinkProps<E> & Omit<React.ComponentProps<E>, keyof SidebarLinkProps<E>>) => {
   const Tag = as || "a";

   return (
      <Tag
         {...otherProps}
         className={twMerge(
            "flex flex-row px-4 items-center gap-2 h-12",
            !disabled &&
               "cursor-pointer rounded-md [&.active]:bg-primary/10 [&.active]:hover:bg-primary/15 [&.active]:font-medium hover:bg-primary/5 focus:bg-primary/5 link",
            disabled && "opacity-50 cursor-not-allowed pointer-events-none",
            className,
         )}
      >
         {children}
      </Tag>
   );
};

type SectionHeaderLinkProps<E extends React.ElementType> = {
   children: React.ReactNode;
   as?: E;
   to?: string; // @todo: workaround
   disabled?: boolean;
   active?: boolean;
   badge?: string | number;
};

export const SectionHeaderLink = <E extends React.ElementType = "a">({
   children,
   as,
   className,
   disabled = false,
   active = false,
   badge,
   ...props
}: SectionHeaderLinkProps<E> & Omit<React.ComponentProps<E>, keyof SectionHeaderLinkProps<E>>) => {
   const Tag = as || "a";

   return (
      <Tag
         {...props}
         className={twMerge(
            "hover:bg-primary/5 flex flex-row items-center justify-center gap-2.5 px-5 h-12 leading-none font-medium text-primary/80 rounded-tr-lg rounded-tl-lg",
            active
               ? "bg-background hover:bg-background text-primary border border-muted border-b-0"
               : "link",
            badge && "pr-4",
            className,
         )}
      >
         {children}
         {badge ? (
            <span className="px-3 py-1 rounded-full font-mono bg-primary/5 text-sm leading-none">
               {badge}
            </span>
         ) : null}
      </Tag>
   );
};

export type SectionHeaderTabsProps = {
   title?: string;
   items?: (Omit<SectionHeaderLinkProps<any>, "children"> & {
      label: string;
   })[];
};
export const SectionHeaderTabs = ({ title, items }: SectionHeaderTabsProps) => {
   return (
      <SectionHeader className="mt-10 border-t pl-3 pb-0 items-end">
         <div className="flex flex-row items-center gap-6 -mb-px">
            {title && (
               <SectionHeaderTitle className="pl-2 hidden md:block">{title}</SectionHeaderTitle>
            )}
            <div className="flex flex-row items-center gap-3">
               {items?.map(({ label, ...item }, key) => (
                  <SectionHeaderLink key={key} {...item}>
                     {label}
                  </SectionHeaderLink>
               ))}
            </div>
         </div>
      </SectionHeader>
   );
};

export function MaxHeightContainer(props: ComponentPropsWithoutRef<"div">) {
   const scrollRef = useRef<React.ElementRef<"div">>(null);
   const [offset, setOffset] = useState(0);
   const [height, setHeight] = useState(window.innerHeight);

   function updateHeaderHeight() {
      if (scrollRef.current) {
         // get offset to top of window
         const offset = scrollRef.current.getBoundingClientRect().top;
         const height = window.innerHeight;
         setOffset(offset);
         setHeight(height);
      }
   }

   useEffect(updateHeaderHeight, []);

   if (typeof window !== "undefined") {
      window.addEventListener("resize", throttle(updateHeaderHeight, 500));
   }

   return (
      <div ref={scrollRef} style={{ height: `${height - offset}px` }} {...props}>
         {props.children}
      </div>
   );
}

export function Scrollable({
   children,
   initialOffset = 64,
}: {
   children: React.ReactNode;
   initialOffset?: number;
}) {
   const scrollRef = useRef<React.ElementRef<"div">>(null);
   const [offset, setOffset] = useState(initialOffset);

   function updateHeaderHeight() {
      if (scrollRef.current) {
         // get offset to top of window
         const offset = scrollRef.current.getBoundingClientRect().top;
         setOffset(offset);
      }
   }

   useEffect(updateHeaderHeight, []);

   if (typeof window !== "undefined") {
      window.addEventListener("resize", throttle(updateHeaderHeight, 500));
   }

   return (
      <ScrollArea.Root style={{ height: `calc(100dvh - ${offset}px` }} ref={scrollRef}>
         <ScrollArea.Viewport className="w-full h-full">{children}</ScrollArea.Viewport>
         <ScrollArea.Scrollbar
            forceMount
            className="flex select-none touch-none bg-transparent w-0.5"
            orientation="vertical"
         >
            <ScrollArea.Thumb className="flex-1 bg-primary/50" />
         </ScrollArea.Scrollbar>
         <ScrollArea.Scrollbar
            forceMount
            className="flex select-none touch-none bg-muted flex-col h-0.5"
            orientation="horizontal"
         >
            <ScrollArea.Thumb className="flex-1 bg-primary/50 " />
         </ScrollArea.Scrollbar>
      </ScrollArea.Root>
   );
}

type SectionHeaderAccordionItemProps = {
   title: string;
   open: boolean;
   toggle: () => void;
   ActiveIcon?: any;
   children?: React.ReactNode;
   renderHeaderRight?: (props: { open: boolean }) => React.ReactNode;
};

export const SectionHeaderAccordionItem = ({
   title,
   open,
   toggle,
   ActiveIcon = IconChevronUp,
   children,
   renderHeaderRight,
}: SectionHeaderAccordionItemProps) => (
   <div
      style={{ minHeight: 49 }}
      className={twMerge(
         "flex flex-col flex-animate overflow-hidden",
         open
            ? "flex-open border-b border-b-muted"
            : "flex-initial cursor-pointer hover:bg-primary/5",
      )}
   >
      <div
         className={twMerge(
            "flex flex-row bg-muted/10 border-muted border-b h-14 py-4 pr-4 pl-2 items-center gap-2",
         )}
         onClick={toggle}
      >
         <IconButton Icon={open ? ActiveIcon : IconChevronDown} disabled={open} />
         <h2 className="text-lg dark:font-bold font-semibold select-text">{title}</h2>
         <div className="flex flex-grow" />
         {renderHeaderRight?.({ open })}
      </div>
      <div
         className={twMerge(
            "overflow-y-scroll transition-all",
            open ? " flex-grow" : "h-0 opacity-0",
         )}
      >
         {children}
      </div>
   </div>
);

export const RouteAwareSectionHeaderAccordionItem = ({
   routePattern,
   identifier,
   ...props
}: Omit<SectionHeaderAccordionItemProps, "open" | "toggle"> & {
   // it's optional because it could be provided using the context
   routePattern?: string;
   identifier: string;
}) => {
   const { active, toggle } = useRoutePathState(routePattern, identifier);
   return <SectionHeaderAccordionItem {...props} open={active} toggle={toggle} />;
};

export const Separator = ({ className, ...props }: ComponentPropsWithoutRef<"hr">) => (
   <hr {...props} className={twMerge("border-muted my-3", className)} />
);

export { Header } from "./Header";
