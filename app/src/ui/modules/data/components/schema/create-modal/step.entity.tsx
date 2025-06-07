import { typeboxResolver } from "@hookform/resolvers/typebox";

import { TextInput, Textarea } from "@mantine/core";
import { useFocusTrap } from "@mantine/hooks";
import { useForm } from "react-hook-form";
import {
   ModalBody,
   ModalFooter,
   type TCreateModalSchema,
   entitySchema,
   useStepContext,
} from "./CreateModal";
import { MantineSelect } from "ui/components/form/hook-form-mantine/MantineSelect";

export function StepEntity() {
   const focusTrapRef = useFocusTrap();

   const { nextStep, stepBack, state, setState } = useStepContext<TCreateModalSchema>();
   const { register, handleSubmit, formState, watch, control } = useForm({
      mode: "onTouched",
      resolver: typeboxResolver(entitySchema),
      defaultValues: state.entities?.create?.[0] ?? {},
   });
   /*const data = watch();
   console.log("state", { isValid });
   console.log("schema", JSON.stringify(entitySchema));
   console.log("data", JSON.stringify(data));*/

   function onSubmit(data: any) {
      console.log(data);
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
