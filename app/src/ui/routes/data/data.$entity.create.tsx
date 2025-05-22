import type { EntityData } from "data";
import { useState } from "react";
import { useEntityMutate } from "ui/client";
import { useBkndData } from "ui/client/schema/data/use-bknd-data";
import { Button } from "ui/components/buttons/Button";
import { Message } from "ui/components/display/Message";
import { useBrowserTitle } from "ui/hooks/use-browser-title";
import { useSearch } from "ui/hooks/use-search";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { Breadcrumbs2 } from "ui/layouts/AppShell/Breadcrumbs2";
import { routes } from "ui/lib/routes";
import { EntityForm } from "ui/modules/data/components/EntityForm";
import { useEntityForm } from "ui/modules/data/hooks/useEntityForm";
import { s } from "core/object/schema";

export function DataEntityCreate({ params }) {
   const { $data } = useBkndData();
   const entity = $data.entity(params.entity as string);
   if (!entity) {
      return <Message.NotFound description={`Entity "${params.entity}" doesn't exist.`} />;
   } else if (entity.type === "system") {
      return <Message.NotAllowed description={`Entity "${params.entity}" cannot be created.`} />;
   }

   const [error, setError] = useState<string | null>(null);
   useBrowserTitle(["Data", entity.label, "Create"]);

   const $q = useEntityMutate(entity.name);

   // @todo: use entity schema for prefilling
   const search = useSearch(s.object({}), {});

   function goBack() {
      window.history.go(-1);
   }

   async function onSubmitted(changeSet?: EntityData) {
      console.log("create:changeSet", changeSet);
      if (!changeSet) return;

      try {
         await $q.create(changeSet);
         if (error) setError(null);
         // @todo: navigate to created?
         goBack();
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
                  <Button onClick={goBack}>Cancel</Button>
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
         >
            <Breadcrumbs2
               path={[
                  { label: entity.label, href: routes.data.entity.list(entity.name) },
                  { label: "Create" },
               ]}
            />
         </AppShell.SectionHeader>
         <AppShell.Scrollable key={entity.name}>
            {error && (
               <div className="flex flex-row dark:bg-red-950 bg-red-100 p-4">
                  <b className="mr-2">Create failed: </b> {error}
               </div>
            )}
            <EntityForm
               entity={entity}
               handleSubmit={handleSubmit}
               fieldsDisabled={fieldsDisabled}
               data={search.value}
               Form={Form}
               action="create"
               className="flex flex-grow flex-col gap-3 p-3"
            />
         </AppShell.Scrollable>
      </>
   );
}
