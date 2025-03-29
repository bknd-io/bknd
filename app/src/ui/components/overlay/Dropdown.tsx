import { useClickOutside } from "@mantine/hooks";
import { clampNumber } from "core/utils";
import {
   type ComponentPropsWithoutRef,
   Fragment,
   type ReactElement,
   type ReactNode,
   cloneElement,
   useState,
} from "react";
import { twMerge } from "tailwind-merge";
import { useEvent } from "ui/hooks/use-event";

export type DropdownItem =
   | (() => ReactNode)
   | {
        label: string | ReactElement;
        icon?: any;
        onClick?: () => void;
        destructive?: boolean;
        disabled?: boolean;
        [key: string]: any;
     };

export type DropdownClickableChild = ReactElement<{ onClick: () => void }>;
export type DropdownProps = {
   className?: string;
   openEvent?: "onClick" | "onContextMenu";
   defaultOpen?: boolean;
   title?: string | ReactElement;
   dropdownWrapperProps?: Omit<ComponentPropsWithoutRef<"div">, "style">;
   position?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
   hideOnEmpty?: boolean;
   items: (DropdownItem | undefined | boolean)[];
   itemsClassName?: string;
   children: DropdownClickableChild;
   onClickItem?: (item: DropdownItem) => void;
   renderItem?: (
      item: DropdownItem,
      props: { key: number; onClick: (e: any) => void },
   ) => DropdownClickableChild;
};

export function Dropdown({
   children,
   defaultOpen = false,
   openEvent = "onClick",
   position: initialPosition = "bottom-start",
   dropdownWrapperProps,
   items,
   title,
   hideOnEmpty = true,
   onClickItem,
   renderItem,
   itemsClassName,
   className,
}: DropdownProps) {
   const [open, setOpen] = useState(defaultOpen);
   const [position, setPosition] = useState(initialPosition);
   const clickoutsideRef = useClickOutside(() => setOpen(false));
   const menuItems = items.filter(Boolean) as DropdownItem[];
   const [_offset, _setOffset] = useState(0);

   const toggle = useEvent((delay: number = 50) =>
      setTimeout(() => setOpen((prev) => !prev), typeof delay === "number" ? delay : 0),
   );

   const onClickHandler =
      openEvent === "onClick"
         ? (e) => {
              e.stopPropagation();
              toggle();
           }
         : undefined;
   const onContextMenuHandler = useEvent((e) => {
      if (openEvent !== "onContextMenu") return;
      e.preventDefault();

      if (open) {
         toggle(0);
         setTimeout(() => {
            setPosition(initialPosition);
            _setOffset(0);
         }, 10);
         return;
      }

      // minimal popper impl, get pos and boundaries
      const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
      const { left = 0, right = 0 } = clickoutsideRef.current?.getBoundingClientRect() ?? {};

      // only if boundaries gien
      if (left > 0 && right > 0) {
         const safe = clampNumber(x, left, right);
         // if pos less than half, go left
         if (x < (left + right) / 2) {
            setPosition("bottom-start");
            _setOffset(safe);
         } else {
            setPosition("bottom-end");
            _setOffset(right - safe);
         }
      } else {
         setPosition(initialPosition);
         _setOffset(0);
      }

      toggle();
   });

   const offset = 4;
   const dropdownStyle = {
      "bottom-start": { top: "100%", left: _offset, marginTop: offset },
      "bottom-end": { right: _offset, top: "100%", marginTop: offset },
      "top-start": { bottom: "100%", marginBottom: offset },
      "top-end": { bottom: "100%", right: _offset, marginBottom: offset },
   }[position];

   const internalOnClickItem = useEvent((item) => {
      if (item.onClick) item.onClick();
      if (onClickItem) onClickItem(item);
      toggle(50);
   });

   if (menuItems.length === 0 && hideOnEmpty) return null;
   const space_for_icon = menuItems.some((item) => "icon" in item && item.icon);

   const itemRenderer =
      renderItem ||
      ((item, { key, onClick }) =>
         typeof item === "function" ? (
            <Fragment key={key}>{item()}</Fragment>
         ) : (
            <button
               type="button"
               key={key}
               disabled={item.disabled}
               className={twMerge(
                  "flex flex-row flex-nowrap text-nowrap items-center outline-none cursor-pointer px-2.5 rounded-md link leading-none h-8",
                  itemsClassName,
                  item.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/10",
                  item.destructive && "text-red-500 hover:bg-red-600 hover:text-white",
               )}
               onClick={onClick}
            >
               {space_for_icon && (
                  <div className="size-[16px] text-left mr-1.5 opacity-80">
                     {item.icon && <item.icon className="size-[16px]" />}
                  </div>
               )}
               {/*{item.icon && <item.icon className="size-4" />}*/}
               <div className="flex flex-grow truncate text-nowrap">{item.label}</div>
            </button>
         ));

   return (
      <div
         role="dropdown"
         className={twMerge("relative flex", className)}
         ref={clickoutsideRef}
         onContextMenu={onContextMenuHandler}
      >
         {cloneElement(children as any, { onClick: onClickHandler })}
         {open && (
            <div
               {...dropdownWrapperProps}
               className={twMerge(
                  "absolute z-30 flex flex-col bg-background border border-muted px-1 py-1 rounded-lg shadow-lg min-w-full",
                  dropdownWrapperProps?.className,
               )}
               style={dropdownStyle}
            >
               {title && (
                  <div className="text-sm font-bold px-2.5 mb-1 mt-1 opacity-50 truncate">
                     {title}
                  </div>
               )}
               {menuItems.map((item, i) =>
                  itemRenderer(item, {
                     key: i,
                     onClick: (e) => {
                        e.stopPropagation();
                        internalOnClickItem(item);
                     },
                  }),
               )}
            </div>
         )}
      </div>
   );
}
