import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { TextInput, Textarea } from "@mantine/core";
import { useFocusTrap } from "@mantine/hooks";
import { useForm } from "react-hook-form";
import { ModalBody, ModalFooter, useStepContext } from "./CreateModal";
import { entitySchema, type TCreateModalSchema } from "./schema";
import { s } from "bknd/utils";
import { cloneSchema } from "core/utils/schema";

const schema = s.object({
   name: entitySchema.properties.name,
   config: entitySchema.properties.config.partial().optional(),
});
type Schema = s.Static<typeof schema>;

export function StepEntity() {
   const focusTrapRef = useFocusTrap();

   const { nextStep, stepBack, state, setState } = useStepContext<TCreateModalSchema>();
   const { register, handleSubmit, formState, watch, control } = useForm({
      mode: "onChange",
      resolver: standardSchemaResolver(cloneSchema(schema)),
      defaultValues: (state.entities?.create?.[0] ?? {}) as Schema,
   });

   function onSubmit(data: any) {
      console.log("onSubmit", data);
      setState((prev) => {
         const prevEntity = prev.entities?.create?.[0];
         if (prevEntity && prevEntity.name !== data.name) {
            return { ...prev, entities: { create: [{ ...data, fields: prevEntity.fields }] } };
         }

         return { ...prev, entities: { create: [data] } };
      });

      if (formState.isValid) {
         console.log("would go next");
         nextStep("entity-fields")();
      }
   }

   return (
      <>
         <form onSubmit={handleSubmit(onSubmit)} ref={focusTrapRef}>
            <ModalBody>
               <input type="hidden" {...register("type")} defaultValue="regular" />
               <TextInput
                  data-autofocus
                  required
                  error={formState.errors.name?.message}
                  {...register("name")}
                  placeholder="posts"
                  size="md"
                  label="What's the name of the entity?"
                  description="Use plural form, and all lowercase. It will be used as the database table."
               />
               <TextInput
                  {...register("config.name")}
                  error={formState.errors.config?.name?.message}
                  placeholder="Posts"
                  size="md"
                  label="How should it be called?"
                  description="Use plural form. This will be used to display in the UI."
               />
               <TextInput
                  {...register("config.name_singular")}
                  error={formState.errors.config?.name_singular?.message}
                  placeholder="Post"
                  size="md"
                  label="What's the singular form of it?"
               />
               <Textarea
                  placeholder="This is a post (optional)"
                  error={formState.errors.config?.description?.message}
                  {...register("config.description")}
                  size="md"
                  label={"Description"}
               />
            </ModalBody>
            <ModalFooter
               next={{
                  type: "submit",
                  disabled: !formState.isValid,
                  //onClick:
               }}
               prev={{ onClick: stepBack }}
               debug={{ state }}
            />
         </form>
      </>
   );
}
