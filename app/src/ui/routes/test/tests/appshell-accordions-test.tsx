import {
   IconAlignJustified,
   IconBolt,
   IconChevronDown,
   IconChevronUp,
   IconCirclesRelation,
   IconSettings,
   IconUser,
} from "@tabler/icons-react";
import { useState } from "react";
import { TbDots } from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import { Button } from "ui/components/buttons/Button";
import { IconButton } from "ui/components/buttons/IconButton";
import { Dropdown } from "ui/components/overlay/Dropdown";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { Breadcrumbs2 } from "ui/layouts/AppShell/Breadcrumbs2";
import { routes } from "ui/lib/routes";

const Item = ({
   title,
   open,
   toggle,
   ActiveIcon = IconChevronUp,
   children,
   renderHeaderRight,
}: {
   title: string;
   open: boolean;
   toggle: () => void;
   ActiveIcon?: any;
   children?: React.ReactNode;
   renderHeaderRight?: (props: { open: boolean }) => React.ReactNode;
}) => (
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
            "flex flex-row border-muted border-b h-14 py-4 pr-4 pl-2 items-center gap-2",
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
         <div className="flex flex-col gap-5 p-4 ">{children}</div>
      </div>
   </div>
);
export default function AppShellAccordionsTest() {
   const [value, setValue] = useState("1");

   function toggle(value) {
      return () => setValue(value);
   }

   return (
      <div className="flex flex-col h-full">
         <AppShell.SectionHeader
            right={
               <Dropdown
                  items={[
                     {
                        label: "Settings",
                     },
                  ]}
                  position="bottom-end"
               >
                  <IconButton Icon={TbDots} />
               </Dropdown>
            }
            className="pl-3"
         >
            <Breadcrumbs2
               path={[{ label: "Schema", href: "/" }, { label: "Quizzes" }]}
               backTo="/"
            />
         </AppShell.SectionHeader>
         <Item
            title="Fields"
            open={value === "1"}
            toggle={toggle("1")}
            ActiveIcon={IconAlignJustified}
            renderHeaderRight={({ open }) =>
               open ? (
                  <Button variant="primary" disabled={!open}>
                     Update
                  </Button>
               ) : null
            }
         />
         <Item
            title="Settings"
            open={value === "2"}
            toggle={toggle("2")}
            ActiveIcon={IconSettings}
         />
         <Item
            title="Relations"
            open={value === "3"}
            toggle={toggle("3")}
            ActiveIcon={IconCirclesRelation}
         />
         <Item title="Indices" open={value === "4"} toggle={toggle("4")} ActiveIcon={IconBolt} />
      </div>
   );
}
