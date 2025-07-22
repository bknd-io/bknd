import { SegmentedControl, Tooltip } from "@mantine/core";
import {
   IconAlignJustified,
   IconCirclesRelation,
   IconDatabase,
   IconExternalLink,
   IconPhoto,
   IconPlus,
   IconSettings,
   IconSwitchHorizontal,
} from "@tabler/icons-react";
import type { Entity, TEntityType } from "bknd";
import { TbDatabasePlus } from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import { useBkndData } from "ui/client/schema/data/use-bknd-data";
import { Button } from "ui/components/buttons/Button";
import { IconButton } from "ui/components/buttons/IconButton";
import { Empty } from "ui/components/display/Empty";
import { Dropdown, type DropdownClickableChild } from "ui/components/overlay/Dropdown";
import { Link, isLinkActive } from "ui/components/wouter/Link";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { routes, useNavigate, useRouteNavigate } from "ui/lib/routes";
import { testIds } from "ui/lib/config";

export function DataRoot({ children }) {
   // @todo: settings routes should be centralized
   const { entities, $data } = useBkndData();
   const entityList: Record<TEntityType, Entity[]> = {
      regular: [],
      generated: [],
      system: [],
   } as const;
   const [navigate] = useNavigate();
   const context = window.location.href.match(/\/schema/) ? "schema" : "data";

   for (const entity of Object.values(entities)) {
      entityList[entity.getType()].push(entity);
   }

   function handleSegmentChange(value?: string) {
      if (!value) return;
      const selected = window.location.href.match(/\/entity\/([^/]+)/)?.[1] || null;
      switch (value) {
         case "data":
            if (selected) {
               navigate(routes.data.entity.list(selected));
            } else {
               navigate(routes.data.root(), { absolute: true });
            }
            break;
         case "schema":
            if (selected) {
               navigate(routes.data.schema.entity(selected));
            } else {
               navigate(routes.data.schema.root());
            }
            break;
      }
   }

   return (
      <>
         <AppShell.Sidebar>
            <AppShell.SectionHeader
               right={
                  <>
                     <SegmentedControl
                        data={[
                           { value: "data", label: "Data" },
                           { value: "schema", label: "Schema" },
                        ]}
                        value={context}
                        onChange={handleSegmentChange}
                     />
                     <Tooltip label="New Entity">
                        <IconButton Icon={TbDatabasePlus} onClick={$data.modals.createEntity} />
                     </Tooltip>
                  </>
               }
            >
               Entities
            </AppShell.SectionHeader>
            <AppShell.Scrollable initialOffset={96}>
               <div className="flex flex-col flex-grow py-3 gap-3">
                  {/*<div className="pt-3 px-3">
                     <SearchInput placeholder="Search entities" />
                  </div>*/}

                  <EntityLinkList entities={entityList.regular} context={context} suggestCreate />
                  <EntityLinkList entities={entityList.system} context={context} title="System" />
                  <EntityLinkList
                     entities={entityList.generated}
                     context={context}
                     title="Generated"
                  />
               </div>
            </AppShell.Scrollable>
         </AppShell.Sidebar>
         <AppShell.Main>{children}</AppShell.Main>
      </>
   );
}

const EntityLinkList = ({
   entities,
   title,
   context,
   suggestCreate = false,
}: { entities: Entity[]; title?: string; context: "data" | "schema"; suggestCreate?: boolean }) => {
   const { $data } = useBkndData();
   const navigate = useRouteNavigate();
   if (entities.length === 0) {
      return suggestCreate ? (
         <Empty
            className="py-10"
            description="Create your first entity to get started."
            secondary={{
               children: "Create entity",
               onClick: () => $data.modals.createEntity(),
            }}
         />
      ) : null;
   }

   function handleClick(entity: Entity) {
      return (e) => {
         e.stopPropagation();
         e.preventDefault();

         switch (context) {
            case "schema":
               navigate((r) => r.data.entity.list(entity.name));
               break;
            case "data":
               navigate((r) => r.data.schema.entity(entity.name));
               break;
         }
      };
   }

   return (
      <nav
         className={twMerge(
            "flex flex-col flex-1 gap-1 px-3",
            title && "border-t border-primary/10 pt-2",
         )}
      >
         {title && <div className="text-sm text-primary/50 ml-3.5 mb-1">{title}</div>}

         {entities.map((entity) => {
            const href =
               context === "data"
                  ? routes.data.entity.list(entity.name)
                  : routes.data.schema.entity(entity.name);
            return (
               <EntityContextMenu key={entity.name} entity={entity}>
                  <AppShell.SidebarLink
                     as={Link}
                     href={href}
                     className="justify-between items-center"
                  >
                     {entity.label}

                     {isLinkActive(href, 1) && (
                        <Button
                           IconLeft={IconSwitchHorizontal}
                           size="small"
                           onClick={handleClick(entity)}
                        >
                           {context === "schema" ? "Data" : "Fields"}
                        </Button>
                     )}
                  </AppShell.SidebarLink>
               </EntityContextMenu>
            );
         })}
      </nav>
   );
};

const EntityContextMenu = ({
   entity,
   children,
   enabled = true,
}: { entity: Entity; children: DropdownClickableChild; enabled?: boolean }) => {
   if (!enabled) return children;
   const [navigate] = useNavigate();
   const { $data } = useBkndData();

   // get href from children (single item)
   const href = (children as any).props.href;
   const separator = () => <div className="h-px my-1 w-full bg-primary/5" />;

   return (
      <Dropdown
         className="flex flex-col w-full"
         dropdownWrapperProps={{
            className: "min-w-fit",
         }}
         title={entity.label + " Actions"}
         items={[
            href && {
               icon: IconExternalLink,
               label: "Open in tab",
               onClick: () => navigate(href, { target: "_blank" }),
            },
            separator,
            !$data.system(entity.name).any && {
               icon: IconPlus,
               label: "Create new",
               onClick: () => navigate(routes.data.entity.create(entity.name)),
            },
            {
               icon: IconDatabase,
               label: "List entries",
               onClick: () => navigate(routes.data.entity.list(entity.name)),
            },
            separator,
            {
               icon: IconAlignJustified,
               label: "Manage fields",
               onClick: () => navigate(routes.data.schema.entity(entity.name)),
            },
            {
               icon: IconCirclesRelation,
               label: "Add relation",
               onClick: () => $data.modals.createRelation(entity.name),
            },
            !$data.system(entity.name).media && {
               icon: IconPhoto,
               label: "Add media",
               onClick: () => $data.modals.createMedia(entity.name),
            },
            separator,
            {
               icon: IconSettings,
               label: "Advanced",
               onClick: () =>
                  navigate(routes.settings.path(["data", "entities", entity.name]), {
                     absolute: true,
                  }),
            },
         ]}
         openEvent="onContextMenu"
         position="bottom-start"
      >
         {children}
      </Dropdown>
   );
};

export function DataEmpty() {
   useBrowserTitle(["Data"]);
   const [navigate] = useNavigate();
   const { $data } = useBkndData();

   function handleButtonClick() {
      navigate(routes.data.schema.root());
   }

   return (
      <Empty
         Icon={IconDatabase}
         title="No entity selected"
         description="Please select an entity from the left sidebar or create a new one to continue."
         secondary={{
            children: "Go to schema",
            onClick: handleButtonClick,
         }}
         primary={{
            children: "Create entity",
            "data-testid": testIds.data.btnCreateEntity,
            onClick: $data.modals.createEntity,
         }}
      />
   );
}
