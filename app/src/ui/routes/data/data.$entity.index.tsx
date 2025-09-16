import type { Entity } from "bknd";
import { repoQuery } from "data/server/query";
import { Fragment } from "react";
import { TbDots } from "react-icons/tb";
import { useApiQuery } from "ui/client";
import { useBknd } from "ui/client/bknd";
import { useBkndData } from "ui/client/schema/data/use-bknd-data";
import { Button } from "ui/components/buttons/Button";
import { IconButton } from "ui/components/buttons/IconButton";
import { Message } from "ui/components/display/Message";
import { Dropdown } from "ui/components/overlay/Dropdown";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import { useSearch } from "ui/hooks/use-search";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { routes, useNavigate } from "ui/lib/routes";
import { useCreateUserModal } from "ui/modules/auth/hooks/use-create-user-modal";
import { EntityTable2 } from "ui/modules/data/components/EntityTable2";
import { s } from "bknd/utils";
import { pick } from "core/utils/objects";

const searchSchema = s.partialObject({
   ...pick(repoQuery.properties, ["select", "where", "sort"]),
   page: s.number({ default: 1 }).optional(),
   perPage: s.number({ default: 10 }).optional(),
});

const PER_PAGE_OPTIONS = [5, 10, 25, 50, 100];

export function DataEntityList({ params }) {
   return <DataEntityListImpl params={params} key={params.entity} />;
}

function DataEntityListImpl({ params }) {
   const { $data } = useBkndData();
   const entity = $data.entity(params.entity as string);
   if (!entity) {
      return <Message.NotFound description={`Entity "${params.entity}" doesn't exist.`} />;
   }

   useBrowserTitle(["Data", entity?.label ?? params.entity]);
   const [navigate] = useNavigate();
   const search = useSearch(searchSchema, {
      defaultValue: {
         select: entity.getSelect(undefined, "table"),
         sort: entity.getDefaultSort(),
      },
      beforeEncode: (v) => {
         if ("sort" in v && v.sort) {
            return {
               ...v,
               sort: `${v.sort.dir === "asc" ? "" : "-"}${v.sort.by}`,
            };
         }
         return v;
      },
   });

   const $q = useApiQuery(
      (api) =>
         api.data.readMany(entity?.name as any, {
            select: search.value.select,
            limit: search.value.perPage,
            offset: (search.value.page - 1) * search.value.perPage,
            sort: `${search.value.sort.dir === "asc" ? "" : "-"}${search.value.sort.by}`,
         }),
      {
         enabled: !!entity,
         revalidateOnFocus: true,
         keepPreviousData: true,
      },
   );
   const data = $q.data?.data;
   const meta = $q.data?.body.meta;

   function handleClickRow(row: Record<string, any>) {
      if (entity) navigate(routes.data.entity.edit(entity.name, row.id));
   }

   function handleClickPage(page: number) {
      search.set({ page });
   }

   function handleSortClick(name: string) {
      const sort = search.value.sort!;
      const newSort = { by: name, dir: sort.by === name && sort.dir === "asc" ? "desc" : "asc" };

      search.set({ sort: newSort as any });
   }

   function handleClickPerPage(perPage: number) {
      search.set({ perPage, page: 1 });
   }

   const isUpdating = $q.isLoading || $q.isValidating;

   return (
      <Fragment key={entity.name}>
         <AppShell.SectionHeader
            right={
               <>
                  <Dropdown
                     items={[
                        {
                           label: "Settings",
                           onClick: () => navigate(routes.data.schema.entity(entity.name)),
                        },
                        {
                           label: "Data Schema",
                           onClick: () => navigate(routes.data.schema.root()),
                        },
                        {
                           label: "Advanced Settings",
                           onClick: () =>
                              navigate(routes.settings.path(["data", "entities", entity.name]), {
                                 absolute: true,
                              }),
                        },
                     ]}
                     position="bottom-end"
                  >
                     <IconButton Icon={TbDots} />
                  </Dropdown>
                  <EntityCreateButton entity={entity} />
               </>
            }
         >
            <AppShell.SectionHeaderTitle>{entity.label}</AppShell.SectionHeaderTitle>
         </AppShell.SectionHeader>
         <AppShell.Scrollable key={entity.name}>
            <div className="flex flex-col flex-grow p-3 gap-3">
               {/*<div className="w-64">
                  <SearchInput placeholder={`Filter ${entity.label}`} />
               </div>*/}

               <div
                  data-updating={isUpdating ? 1 : undefined}
                  className="data-[updating]:opacity-50 transition-opacity pb-10"
               >
                  <EntityTable2
                     data={data ?? null}
                     entity={entity}
                     select={search.value.select}
                     onClickRow={handleClickRow}
                     page={search.value.page}
                     sort={search.value.sort}
                     onClickSort={handleSortClick}
                     perPage={search.value.perPage}
                     perPageOptions={PER_PAGE_OPTIONS}
                     total={meta?.count}
                     onClickPage={handleClickPage}
                     onClickPerPage={handleClickPerPage}
                  />
               </div>
            </div>
         </AppShell.Scrollable>
      </Fragment>
   );
}

function EntityCreateButton({ entity }: { entity: Entity }) {
   const b = useBknd();
   const createUserModal = useCreateUserModal();

   const [navigate] = useNavigate();
   if (!entity) return null;
   if (entity.type === "system") {
      const system = {
         users: b.app.config.auth.entity_name,
         media: b.app.config.media.entity_name,
      };
      if (system.users === entity.name) {
         return (
            <Button onClick={createUserModal.open} variant="primary">
               New User
            </Button>
         );
      }

      return null;
   }

   return (
      <Button
         onClick={() => {
            navigate(routes.data.entity.create(entity.name));
         }}
         variant="primary"
      >
         Create new
      </Button>
   );
}
