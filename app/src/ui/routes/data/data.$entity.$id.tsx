import type { PrimaryFieldType } from "core";
import { ucFirst } from "core/utils";
import type { Entity, EntityData, EntityRelation } from "data";
import { Fragment, useState } from "react";
import { TbDots } from "react-icons/tb";
import { useApiQuery, useEntityQuery } from "ui/client";
import { useBkndData } from "ui/client/schema/data/use-bknd-data";
import { Button } from "ui/components/buttons/Button";
import { IconButton } from "ui/components/buttons/IconButton";
import { Message } from "ui/components/display/Message";
import { Dropdown } from "ui/components/overlay/Dropdown";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { Breadcrumbs2 } from "ui/layouts/AppShell/Breadcrumbs2";
import { routes, useNavigate } from "ui/lib/routes";
import { bkndModals } from "ui/modals";
import { EntityForm } from "ui/modules/data/components/EntityForm";
import { EntityTable2 } from "ui/modules/data/components/EntityTable2";
import { useEntityForm } from "ui/modules/data/hooks/useEntityForm";

export function DataEntityUpdate({ params }) {
   const { $data, relations } = useBkndData();
   const entity = $data.entity(params.entity as string);
   if (!entity) {
      return <Message.NotFound description={`Entity "${params.entity}" doesn't exist.`} />;
   }

   const entityId = params.id as PrimaryFieldType;
   const [error, setError] = useState<string | null>(null);
   const [navigate] = useNavigate();
   useBrowserTitle(["Data", entity.label, `#${entityId}`]);
   const targetRelations = relations.listableRelationsOf(entity);

   const local_relation_refs = relations
      .sourceRelationsOf(entity)
      ?.map((r) => r.other(entity).reference);

   const $q = useEntityQuery(
      entity.name,
      entityId,
      {
         with: local_relation_refs,
      },
      {
         keepPreviousData: false,
         revalidateOnFocus: false,
         shouldRetryOnError: false,
      },
   );

   function goBack() {
      window.history.go(-1);
   }

   async function onSubmitted(changeSet?: EntityData) {
      //return;
      if (!changeSet) {
         goBack();
         return;
      }

      try {
         await $q.update(changeSet);
         if (error) setError(null);
         goBack();
      } catch (e) {
         setError(e instanceof Error ? e.message : "Failed to update");
      }
   }

   async function handleDelete() {
      if (confirm("Are you sure to delete?")) {
         try {
            await $q._delete();
            if (error) setError(null);
            goBack();
         } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to delete");
         }
      }
   }

   const data = $q.data;
   const { Form, handleSubmit } = useEntityForm({
      action: "update",
      entity,
      initialData: $q.data?.toJSON(),
      onSubmitted,
   });

   if (!data && !$q.isLoading) {
      return (
         <Message.NotFound
            description={`Entity "${params.entity}" with ID "${entityId}" doesn't exist.`}
         />
      );
   }

   const makeKey = (key: string | number = "") => `${entity.name}_${entityId}_${String(key)}`;

   const fieldsDisabled = $q.isLoading || $q.isValidating || Form.state.isSubmitting;

   return (
      <Fragment key={makeKey()}>
         <AppShell.SectionHeader
            right={
               <>
                  <Dropdown
                     position="bottom-end"
                     items={[
                        {
                           label: "Inspect",
                           onClick: () => {
                              bkndModals.open("debug", {
                                 data: {
                                    data: data as any,
                                    entity: entity.toJSON(),
                                    schema: entity.toSchema({ clean: true }),
                                    form: Form.state.values,
                                    state: Form.state,
                                 },
                              });
                           },
                        },
                        {
                           label: "Settings",
                           onClick: () =>
                              navigate(routes.settings.path(["data", "entities", entity.name]), {
                                 absolute: true,
                              }),
                        },
                        {
                           label: "Delete",
                           onClick: handleDelete,
                           destructive: true,
                           disabled: fieldsDisabled,
                        },
                     ]}
                  >
                     <IconButton Icon={TbDots} />
                  </Dropdown>
                  <Form.Subscribe
                     selector={(state) => [state.canSubmit, state.isSubmitting]}
                     children={([canSubmit, isSubmitting]) => (
                        <Button
                           type="button"
                           onClick={Form.handleSubmit}
                           variant="primary"
                           tabIndex={entity.fields.length + 1}
                           disabled={!canSubmit || isSubmitting || fieldsDisabled}
                        >
                           Update
                        </Button>
                     )}
                  />
               </>
            }
            className="pl-3"
         >
            <Breadcrumbs2
               path={[
                  { label: entity.label, href: routes.data.entity.list(entity.name) },
                  { label: `Edit #${entityId}` },
               ]}
            />
         </AppShell.SectionHeader>
         {$q.isLoading ? (
            <div className="w-full h-full flex justify-center items-center font-mono opacity-30">
               Loading...
            </div>
         ) : (
            <AppShell.Scrollable>
               {error && (
                  <div className="flex flex-row dark:bg-red-950 bg-red-100 p-4">
                     <b className="mr-2">Update failed: </b> {error}
                  </div>
               )}
               <EntityForm
                  entity={entity}
                  entityId={entityId}
                  handleSubmit={handleSubmit}
                  fieldsDisabled={fieldsDisabled}
                  data={data ?? undefined}
                  Form={Form}
                  action="update"
                  className="flex flex-grow flex-col gap-3 p-3"
               />
               {targetRelations.length > 0 ? (
                  <EntityDetailRelations
                     id={entityId}
                     entity={entity}
                     relations={targetRelations}
                  />
               ) : null}
            </AppShell.Scrollable>
         )}
      </Fragment>
   );
}

function EntityDetailRelations({
   id,
   entity,
   relations,
}: {
   id: PrimaryFieldType;
   entity: Entity;
   relations: EntityRelation[];
}) {
   const [selected, setSelected] = useState<EntityRelation>(
      // @ts-ignore
      relations.length > 0 ? relations[0] : undefined,
   );

   function handleClick(relation: EntityRelation) {
      setSelected(relation);
   }

   if (relations.length === 0) {
      return null;
   }

   //console.log("selected", selected, relations[0].helper(entity.name).other.reference);

   return (
      <div className="flex flex-col max-w-full">
         <AppShell.SectionHeaderTabs
            title="Relations"
            items={relations.map((relation) => {
               const other = relation.other(entity);

               return {
                  as: "button",
                  type: "button",
                  label: ucFirst(other.reference),
                  onClick: () => handleClick(relation),
                  active: selected?.other(entity).reference === other.reference,
                  badge: relation.type(),
               };
            })}
         />
         <div className="flex flex-grow flex-col gap-3 p-3">
            <EntityDetailInner id={id} entity={entity} relation={selected} />
         </div>
      </div>
   );
}

function EntityDetailInner({
   id,
   entity,
   relation,
}: {
   id: PrimaryFieldType;
   entity: Entity;
   relation: EntityRelation;
}) {
   const other = relation.other(entity);
   const [navigate] = useNavigate();

   const search = {
      select: other.entity.getSelect(undefined, "table"),
      limit: 10,
      offset: 0,
   };
   // @todo: add custom key for invalidation
   const $q = useApiQuery((api) =>
      api.data.readManyByReference(entity.name, id, other.reference, search),
   );

   function handleClickRow(row: Record<string, any>) {
      navigate(routes.data.entity.edit(other.entity.name, row.id));
   }

   let handleClickNew: any;
   try {
      if (other.entity.type !== "system") {
         const ref = relation.getReferenceQuery(other.entity, id, other.reference);
         handleClickNew = () => {
            navigate(routes.data.entity.create(other.entity.name), {
               query: ref.where,
            });
            //navigate(routes.data.entity.create(other.entity.name) + `?${query}`);
         };
      }
   } catch (e) {}

   if (!$q.data) {
      return null;
   }

   const isUpdating = $q.isValidating || $q.isLoading;

   return (
      <div
         data-updating={isUpdating ? 1 : undefined}
         className="transition-opacity data-[updating]:opacity-50"
      >
         <EntityTable2
            select={search.select}
            data={$q.data ?? null}
            entity={other.entity}
            onClickRow={handleClickRow}
            onClickNew={handleClickNew}
            page={1}
            total={$q.data?.body?.meta?.count ?? 1}
            /*onClickPage={handleClickPage}*/
         />
      </div>
   );
}
