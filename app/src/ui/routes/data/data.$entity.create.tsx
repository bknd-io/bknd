import type { EntityData } from "bknd";
import { useState } from "react";
import { useEntityMutate } from "ui/client";
import { useBkndData } from "ui/client/schema/data/use-bknd-data";
import { Button } from "ui/components/buttons/Button";
import { Message } from "ui/components/display/Message";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import { useSearch } from "ui/hooks/use-search";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { Breadcrumbs2 } from "ui/layouts/AppShell/Breadcrumbs2";
import { routes, useNavigate } from "ui/lib/routes";
import { EntityForm } from "ui/modules/data/components/EntityForm";
import { useEntityForm } from "ui/modules/data/hooks/useEntityForm";
import { s } from "bknd/utils";
import { notifications } from "@mantine/notifications";
import { useEntityAdminOptions } from "ui/options";
import { Dropdown } from "ui/components/overlay/Dropdown";
import { TbDots } from "react-icons/tb";
import { IconButton } from "ui/components/buttons/IconButton";

export function DataEntityCreate({ params }) {
   const { $data } = useBkndData();
   const [navigate, _, _goBack] = useNavigate();
   const entity = $data.entity(params.entity as string);
   if (!entity) {
      return <Message.NotFound description={`Entity "${params.entity}" doesn't exist.`} />;
   } else if (entity.type === "system") {
      return <Message.NotAllowed description={`Entity "${params.entity}" cannot be created.`} />;
   }
   const options = useEntityAdminOptions(entity, "create");

   const [error, setError] = useState<string | null>(null);
   useBrowserTitle(["Data", entity.label, "Create"]);

   const $q = useEntityMutate(entity.name);

   // @todo: use entity schema for prefilling
   const search = useSearch(s.object({}), {});

   const backHref = routes.data.entity.list(entity.name);
   const goBack = () => _goBack({ fallback: backHref });

   async function onSubmitted(changeSet?: EntityData) {
      console.log("create:changeSet", changeSet);
      if (!changeSet) return;

      try {
         const result = await $q.create(changeSet);
         if (error) setError(null);
         if (result.id) {
            notifications.show({
               title: `Creating ${entity?.label}`,
               message: `Successfully created with ID ${result.id}`,
               color: "green",
            });
            navigate(routes.data.entity.edit(params.entity, result.id));
         } else {
            goBack();
         }
      } catch (e) {
         setError(e instanceof Error ? e.message : "Failed to create");
      }
   }

   const { Form, handleSubmit } = useEntityForm({
      action: "create",
      entity: entity,
      initialData: search.value,
      onSubmitted,
   });

   const fieldsDisabled = $q.isLoading || $q.isValidating || Form.state.isSubmitting;

   return (
      <>
         <AppShell.SectionHeader
            right={
               <>
                  {options.actions?.context && (
                     <Dropdown position="bottom-end" items={options.actions.context}>
                        <IconButton Icon={TbDots} />
                     </Dropdown>
                  )}
                  <Button onClick={goBack}>Cancel</Button>
                  {options.actions?.primary?.map(
                     (button, key) =>
                        button && <Button {...button} type="button" key={key} variant="primary" />,
                  )}
                  <Form.Subscribe
                     selector={(state) => [state.canSubmit, state.isSubmitting]}
                     children={([canSubmit, isSubmitting]) => (
                        <Button
                           type="button"
                           onClick={Form.handleSubmit}
                           variant="primary"
                           tabIndex={entity.fields.length}
                           disabled={!canSubmit || isSubmitting}
                        >
                           Create
                        </Button>
                     )}
                  />
               </>
            }
            className="pl-3"
         >
            <Breadcrumbs2
               backTo={backHref}
               path={[{ label: entity.label, href: backHref }, { label: "Create" }]}
            />
         </AppShell.SectionHeader>
         <AppShell.Scrollable key={entity.name}>
            {options.header}
            {error && (
               <div className="flex flex-row dark:bg-red-950 bg-red-100 p-4">
                  <b className="mr-2">Create failed: </b> {error}
               </div>
            )}
            <EntityForm
               entity={entity}
               handleSubmit={handleSubmit}
               fieldsDisabled={fieldsDisabled}
               data={search.value as any}
               Form={Form}
               action="create"
               className="flex flex-grow flex-col gap-3 p-3"
            />
            {options.footer}
         </AppShell.Scrollable>
      </>
   );
}
