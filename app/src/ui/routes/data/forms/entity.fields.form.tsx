import { typeboxResolver } from "@hookform/resolvers/typebox";
import { Tabs, TextInput, Textarea, Tooltip, Switch } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
   Default,
   type Static,
   StringIdentifier,
   objectCleanEmpty,
   ucFirstAllSnakeToPascalWithSpaces,
} from "core/utils";
import {
   type TAppDataEntityFields,
   fieldsSchemaObject as originalFieldsSchemaObject,
} from "data/data-schema";
import { omit } from "lodash-es";
import { forwardRef, memo, useEffect, useImperativeHandle } from "react";
import { type FieldArrayWithId, type UseFormReturn, useFieldArray, useForm } from "react-hook-form";
import { TbGripVertical, TbSettings, TbTrash } from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import { Button } from "ui/components/buttons/Button";
import { IconButton } from "ui/components/buttons/IconButton";
import { JsonViewer } from "ui/components/code/JsonViewer";
import { MantineSwitch } from "ui/components/form/hook-form-mantine/MantineSwitch";
import { JsonSchemaForm } from "ui/components/form/json-schema";
import { type SortableItemProps, SortableList } from "ui/components/list/SortableList";
import { Popover } from "ui/components/overlay/Popover";
import { type TFieldSpec, fieldSpecs } from "ui/modules/data/components/fields-specs";
import { dataFieldsUiSchema } from "../../settings/routes/data.settings";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

const fieldsSchemaObject = originalFieldsSchemaObject;
const fieldsSchema = Type.Union(Object.values(fieldsSchemaObject));

const fieldSchema = Type.Object(
   {
      name: StringIdentifier,
      new: Type.Optional(Type.Boolean({ const: true })),
      field: fieldsSchema,
   },
   {
      additionalProperties: false,
   },
);
type TFieldSchema = Static<typeof fieldSchema>;

const schema = Type.Object({
   fields: Type.Array(fieldSchema),
});
type TFieldsFormSchema = Static<typeof schema>;

const fieldTypes = Object.keys(fieldsSchemaObject);
const defaultType = fieldTypes[0];
const commonProps = ["label", "description", "required", "fillable", "hidden", "virtual"];

function specificFieldSchema(type: keyof typeof fieldsSchemaObject) {
   //console.log("specificFieldSchema", type);
   return Type.Omit(fieldsSchemaObject[type]?.properties.config, commonProps);
}

export type EntityFieldsFormProps = {
   fields: TAppDataEntityFields;
   onChange?: (formData: TAppDataEntityFields) => void;
   sortable?: boolean;
   additionalFieldTypes?: (TFieldSpec & { onClick: () => void })[];
};

export type EntityFieldsFormRef = {
   getValues: () => TFieldsFormSchema;
   getData: () => TAppDataEntityFields;
   isValid: () => boolean;
   getErrors: () => any;
   reset: () => void;
};

export const EntityFieldsForm = forwardRef<EntityFieldsFormRef, EntityFieldsFormProps>(
   function EntityFieldsForm({ fields: _fields, sortable, additionalFieldTypes, ...props }, ref) {
      const entityFields = Object.entries(_fields).map(([name, field]) => ({
         name,
         field,
      }));

      const {
         control,
         formState: { isValid, errors },
         getValues,
         watch,
         register,
         setValue,
         setError,
         reset,
      } = useForm({
         mode: "all",
         resolver: typeboxResolver(schema),
         defaultValues: {
            fields: entityFields,
         } as TFieldsFormSchema,
      });
      const { fields, append, remove, move } = useFieldArray({
         control,
         name: "fields",
      });

      function toCleanValues(formData: TFieldsFormSchema): TAppDataEntityFields {
         return Object.fromEntries(
            formData.fields.map((field) => [field.name, objectCleanEmpty(field.field)]),
         );
      }

      useEffect(() => {
         if (props?.onChange) {
            watch((data: any) => {
               props?.onChange?.(toCleanValues(data));
            });
         }
      }, []);

      useImperativeHandle(ref, () => ({
         reset,
         getValues: () => getValues(),
         getData: () => {
            return toCleanValues(getValues());
         },
         isValid: () => isValid,
         getErrors: () => errors,
      }));

      function handleAppend(_type: keyof typeof fieldsSchemaObject) {
         const newField = {
            name: "",
            new: true,
            field: {
               type: _type,
               config: Default(fieldsSchemaObject[_type]?.properties.config, {}) as any,
            },
         };
         append(newField);
      }

      const formProps = {
         watch,
         register,
         setValue,
         getValues,
         control,
         setError,
      };
      return (
         <>
            <div className="flex flex-col gap-6">
               <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-4">
                     {sortable ? (
                        <SortableList
                           data={fields}
                           key={fields.length}
                           onReordered={move}
                           extractId={(item) => item.id}
                           disableIndices={[0]}
                           renderItem={({ dnd, ...props }, index) => (
                              <EntityFieldMemo
                                 key={props.id}
                                 field={props as any}
                                 index={index}
                                 form={formProps}
                                 errors={errors}
                                 remove={remove}
                                 dnd={dnd}
                              />
                           )}
                        />
                     ) : (
                        <div>
                           {fields.map((field, index) => (
                              <EntityField
                                 key={field.id}
                                 field={field as any}
                                 index={index}
                                 form={formProps}
                                 errors={errors}
                                 remove={remove}
                              />
                           ))}
                        </div>
                     )}

                     <Popover
                        className="flex flex-col w-full"
                        target={({ toggle }) => (
                           <SelectType
                              additionalFieldTypes={additionalFieldTypes}
                              onSelected={toggle}
                              onSelect={(type) => {
                                 handleAppend(type as any);
                              }}
                           />
                        )}
                     >
                        <Button className="justify-center">Add Field</Button>
                     </Popover>
                  </div>
               </div>
            </div>
         </>
      );
   },
);

const SelectType = ({
   onSelect,
   additionalFieldTypes = [],
   onSelected,
}: {
   onSelect: (type: string) => void;
   additionalFieldTypes?: (TFieldSpec & { onClick?: () => void })[];
   onSelected?: () => void;
}) => {
   const types: (TFieldSpec & { onClick?: () => void })[] = fieldSpecs.filter(
      (s) => s.addable !== false,
   );

   if (additionalFieldTypes) {
      types.push(...additionalFieldTypes);
   }

   return (
      <div className="flex flex-row gap-2 justify-center flex-wrap">
         {types.map((type) => (
            <Button
               key={type.type}
               IconLeft={type.icon}
               variant="ghost"
               onClick={() => {
                  if (type.addable !== false) {
                     onSelect(type.type);
                  } else {
                     type.onClick?.();
                  }
                  onSelected?.();
               }}
            >
               {type.label}
            </Button>
         ))}
      </div>
   );
};

const Debug = ({ watch, errors }) => {
   return (
      <div>
         <div>
            {Object.entries(errors).map(([key, value]) => (
               <p key={key}>
                  {/* @ts-ignore */}
                  {key}: {value.message}
               </p>
            ))}
         </div>
         <pre>{JSON.stringify(watch(), null, 2)}</pre>
      </div>
   );
};

const EntityFieldMemo = memo(EntityField, (prev, next) => {
   return prev.field.id !== next.field.id;
});

function EntityField({
   field,
   index,
   form: { watch, register, setValue, getValues, control, setError },
   remove,
   errors,
   dnd,
}: {
   field: FieldArrayWithId<TFieldsFormSchema, "fields", "id">;
   index: number;
   form: Pick<
      UseFormReturn<any>,
      "watch" | "register" | "setValue" | "getValues" | "control" | "setError"
   >;
   remove: (index: number) => void;
   errors: any;
   dnd?: SortableItemProps;
}) {
   const [opened, handlers] = useDisclosure(false);
   const prefix = `fields.${index}.field` as const;
   const type = field.field.type;
   const name = watch(`fields.${index}.name`);
   const fieldSpec = fieldSpecs.find((s) => s.type === type)!;
   const specificData = omit(field.field.config, commonProps);
   const disabled = fieldSpec.disabled || [];
   const hidden = fieldSpec.hidden || [];
   const dragDisabled = index === 0;
   const hasErrors = !!errors?.fields?.[index];
   const is_primary = type === "primary";

   function handleDelete(index: number) {
      return () => {
         if (name.length === 0) {
            remove(index);
            return;
         }
         window.confirm(`Sure to delete "${name}"?`) && remove(index);
      };
   }
   //console.log("register", register(`${prefix}.config.required`));
   const dndProps = dnd ? { ...dnd.provided.draggableProps, ref: dnd.provided.innerRef } : {};

   return (
      <div
         key={field.id}
         className={twMerge(
            "flex flex-col border border-muted rounded bg-background mb-2",
            opened && "mb-6",
            hasErrors && "border-red-500 ",
         )}
         {...dndProps}
      >
         <div className="flex flex-row gap-2 px-2 py-2">
            {dnd ? (
               <div className="flex items-center" {...dnd.provided.dragHandleProps}>
                  <IconButton Icon={TbGripVertical} className="mt-1" disabled={dragDisabled} />
               </div>
            ) : null}
            <div className="flex flex-row flex-grow gap-4 items-center md:mr-6">
               <Tooltip label={fieldSpec.label}>
                  <div className="flex flex-row items-center p-2 bg-primary/5 rounded">
                     <fieldSpec.icon className="size-5" />
                  </div>
               </Tooltip>

               {field.new ? (
                  <TextInput
                     error={!!errors?.fields?.[index]?.name.message}
                     placeholder="Enter a property name..."
                     classNames={{
                        root: "w-full h-full",
                        wrapper: "font-mono h-full",
                        input: "pt-px !h-full",
                     }}
                     {...register(`fields.${index}.name`)}
                     disabled={!field.new}
                  />
               ) : (
                  <div className="font-mono flex-grow flex flex-row gap-3">
                     <span>{name}</span>
                     {field.field.config?.label && (
                        <span className="opacity-50">{field.field.config?.label}</span>
                     )}
                  </div>
               )}
               <div className="flex-col gap-1 hidden md:flex">
                  <span className="text-xs text-primary/50 leading-none">Required</span>
                  {is_primary ? (
                     <Switch size="sm" defaultChecked disabled />
                  ) : (
                     <MantineSwitch
                        size="sm"
                        name={`${prefix}.config.required`}
                        control={control}
                     />
                  )}
               </div>
            </div>
            <div className="flex items-end">
               <div className="flex flex-row gap-4">
                  <IconButton
                     size="lg"
                     Icon={TbSettings}
                     disabled={is_primary}
                     iconProps={{ strokeWidth: 1.5 }}
                     onClick={handlers.toggle}
                     variant={opened ? "primary" : "ghost"}
                  />
               </div>
            </div>
         </div>
         {opened && (
            <div className="flex flex-col border-t border-t-muted px-3 py-2 bg-lightest/50">
               {/*<pre>{JSON.stringify(field, null, 2)}</pre>*/}
               <Tabs defaultValue="general">
                  <Tabs.List className="flex flex-row">
                     <Tabs.Tab value="general">General</Tabs.Tab>
                     <Tabs.Tab value="specific">{ucFirstAllSnakeToPascalWithSpaces(type)}</Tabs.Tab>
                     <Tabs.Tab value="visibility" disabled>
                        Visiblity
                     </Tabs.Tab>
                     <div className="flex flex-grow" />
                     <Tabs.Tab value="code" className="!self-end">
                        Code
                     </Tabs.Tab>
                  </Tabs.List>
                  <Tabs.Panel value="general">
                     <div className="flex flex-col gap-2 pt-3 pb-1" key={`${prefix}_${type}`}>
                        <div className="flex flex-row">
                           <MantineSwitch
                              label="Required"
                              name={`${prefix}.config.required`}
                              control={control}
                           />
                        </div>
                        <TextInput
                           label="Label"
                           placeholder="Label"
                           {...register(`${prefix}.config.label`)}
                        />
                        <Textarea
                           label="Description"
                           placeholder="Description"
                           {...register(`${prefix}.config.description`)}
                        />
                        {!hidden.includes("virtual") && (
                           <MantineSwitch
                              label="Virtual"
                              name={`${prefix}.config.virtual`}
                              control={control}
                              disabled={disabled.includes("virtual")}
                           />
                        )}
                     </div>
                  </Tabs.Panel>
                  <Tabs.Panel value="specific">
                     <div className="flex flex-col gap-2 pt-3 pb-1">
                        <JsonSchemaForm
                           key={type}
                           schema={specificFieldSchema(type as any)}
                           formData={specificData}
                           uiSchema={dataFieldsUiSchema.config}
                           className="legacy hide-required-mark fieldset-alternative mute-root"
                           onChange={(value) => {
                              setValue(`${prefix}.config`, {
                                 ...getValues([`fields.${index}.config`])[0],
                                 ...value,
                              });
                           }}
                        />
                     </div>
                  </Tabs.Panel>
                  <Tabs.Panel value="code">
                     {(() => {
                        const { id, ...json } = field;
                        return <JsonViewer json={json} expand={4} />;
                     })()}
                  </Tabs.Panel>
                  <div className="flex flex-row justify-end">
                     <Button
                        IconLeft={TbTrash}
                        onClick={handleDelete(index)}
                        size="small"
                        variant="subtlered"
                     >
                        Delete
                     </Button>
                  </div>
               </Tabs>
            </div>
         )}
      </div>
   );
}
