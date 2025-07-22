import { Radio, TextInput } from "@mantine/core";
import { transformObject, s, stringIdentifier } from "bknd/utils";
import type { MediaFieldConfig } from "media/MediaField";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useBknd } from "ui/client/bknd";
import { MantineNumberInput } from "ui/components/form/hook-form-mantine/MantineNumberInput";
import { MantineRadio } from "ui/components/form/hook-form-mantine/MantineRadio";
import { MantineSelect } from "ui/components/form/hook-form-mantine/MantineSelect";
import { ModalBody, ModalFooter, useStepContext } from "../../CreateModal";
import type { TCreateModalSchema, TFieldCreate } from "../../schema";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";

const schema = s.object({
   entity: stringIdentifier,
   cardinality_type: s.string({ enum: ["single", "multiple"], default: "multiple" }),
   cardinality: s.number({ minimum: 1 }).optional(),
   name: stringIdentifier,
});
type TCreateModalMediaSchema = s.Static<typeof schema>;

export function TemplateMediaComponent() {
   const { stepBack, setState, state, path, nextStep } = useStepContext<TCreateModalSchema>();
   const {
      register,
      handleSubmit,
      formState: { isValid, errors },
      watch,
      control,
   } = useForm({
      mode: "onChange",
      resolver: standardSchemaResolver(schema),
      defaultValues: schema.template(state.initial ?? {}) as TCreateModalMediaSchema,
      //defaultValues: Default(schema, state.initial ?? {}) as TCreateModalMediaSchema,
   });
   const [forbidden, setForbidden] = useState<boolean>(false);

   const { config } = useBknd();
   const media_enabled = config.media.enabled ?? false;
   const media_entity = config.media.entity_name ?? "media";
   const entities = transformObject(config.data.entities ?? {}, (entity, name) =>
      name !== media_entity ? entity : undefined,
   );
   const data = watch();
   const forbidden_field_names = Object.keys(config.data.entities?.[data.entity]?.fields ?? {});

   useEffect(() => {
      setForbidden(forbidden_field_names.includes(data.name));
   }, [forbidden_field_names, data.name]);

   async function handleCreate() {
      if (isValid && !forbidden) {
         const { field, relation } = convert(media_entity, data);

         setState((prev) => ({
            ...prev,
            fields: { create: [field] },
            relations: { create: [relation] },
         }));

         nextStep("create")();
      }
   }

   return (
      <>
         {!media_enabled && (
            <div className="px-5 py-4 bg-red-100 text-red-900">
               Media is not enabled in the configuration. Please enable it to use this template.
            </div>
         )}
         <form onSubmit={handleSubmit(handleCreate)}>
            <ModalBody>
               <div className="flex flex-col gap-6">
                  <MantineSelect
                     name="entity"
                     allowDeselect={false}
                     control={control}
                     size="md"
                     label="Choose which entity to add media to"
                     required
                     data={Object.entries(entities).map(([name, entity]) => ({
                        value: name,
                        label: entity.config?.name ?? name,
                     }))}
                  />
                  <MantineRadio.Group
                     name="cardinality_type"
                     control={control}
                     label="How many items can be attached?"
                     size="md"
                  >
                     <div className="flex flex-col gap-1">
                        <Radio label="Multiple items" value="multiple" />
                        <Radio label="Single item" value="single" />
                     </div>
                  </MantineRadio.Group>
                  {data.cardinality_type === "multiple" && (
                     <MantineNumberInput
                        name="cardinality"
                        control={control}
                        size="md"
                        label="How many exactly?"
                        placeholder="n"
                        description="Leave empty for unlimited"
                        inputWrapperOrder={["label", "input", "description", "error"]}
                     />
                  )}
                  <TextInput
                     size="md"
                     label="Set a name for the property"
                     required
                     description={`A virtual property will be added to ${
                        data.entity ? data.entity : "the entity"
                     }.`}
                     {...register("name")}
                     error={
                        errors.name?.message
                           ? errors.name?.message
                           : forbidden
                             ? `Property "${data.name}" already exists on entity ${data.entity}`
                             : undefined
                     }
                  />
               </div>
               {/*<p>step template media</p>
               <pre>{JSON.stringify(state, null, 2)}</pre>
               <pre>{JSON.stringify(data, null, 2)}</pre>*/}
            </ModalBody>
            <ModalFooter
               next={{
                  type: "submit",
                  disabled: !isValid || !media_enabled || forbidden,
               }}
               prev={{
                  onClick: stepBack,
               }}
               debug={{ state, path, data }}
            />
         </form>
      </>
   );
}

function convert(media_entity: string, data: TCreateModalMediaSchema) {
   const field: {
      entity: string;
      name: string;
      field: { type: "media"; config: MediaFieldConfig };
   } = {
      name: data.name,
      entity: data.entity,
      field: {
         type: "media" as any,
         config: {
            required: false,
            fillable: ["update"],
            hidden: false,
            mime_types: [],
            virtual: true,
            entity: data.entity,
         },
      },
   };

   const relation = {
      type: "poly",
      source: data.entity,
      target: media_entity,
      config: {
         mappedBy: data.name,
         targetCardinality: data.cardinality_type === "single" ? 1 : undefined,
      },
   };

   if (data.cardinality_type === "multiple") {
      if (data.cardinality && data.cardinality > 1) {
         field.field.config.max_items = data.cardinality;
         relation.config.targetCardinality = data.cardinality;
      }
   } else {
      field.field.config.max_items = 1;
      relation.config.targetCardinality = 1;
   }

   // force fix types
   const _field = field as unknown as TFieldCreate;

   return { field: _field, relation };
}
