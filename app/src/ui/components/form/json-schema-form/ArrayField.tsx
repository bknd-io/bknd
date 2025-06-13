import { IconLibraryPlus, IconTrash } from "@tabler/icons-react";
import type { JsonSchema } from "json-schema-library";
import { memo, useMemo } from "react";
import { Button } from "ui/components/buttons/Button";
import { IconButton } from "ui/components/buttons/IconButton";
import { Dropdown } from "ui/components/overlay/Dropdown";
import { useEvent } from "ui/hooks/use-event";
import { FieldComponent } from "./Field";
import { FieldWrapper } from "./FieldWrapper";
import { useDerivedFieldContext, useFormValue } from "./Form";
import { coerce, getMultiSchema, getMultiSchemaMatched, isEqual, suffixPath } from "./utils";

export const ArrayField = ({ path = "" }: { path?: string }) => {
   const { setValue, pointer, required, schema, ...ctx } = useDerivedFieldContext(path);
   if (!schema || typeof schema === "undefined") return `ArrayField(${path}): no schema ${pointer}`;

   // if unique items with enum
   if (schema.uniqueItems && typeof schema.items === "object" && "enum" in schema.items) {
      return (
         <FieldWrapper name={path} schema={schema} wrapper="fieldset">
            <FieldComponent
               required
               name={path}
               schema={schema.items}
               multiple
               className="h-auto"
               onChange={(e: any) => {
                  // @ts-ignore
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setValue(ctx.path, selected);
               }}
            />
         </FieldWrapper>
      );
   }

   return (
      <FieldWrapper name={path} schema={schema} wrapper="fieldset">
         <ArrayIterator name={path}>
            {({ value }) =>
               value?.map((v, index: number) => (
                  <ArrayItem key={index} path={path} index={index} schema={schema} />
               ))
            }
         </ArrayIterator>
         <div className="flex flex-row">
            <ArrayAdd path={path} schema={schema} />
         </div>
      </FieldWrapper>
   );
};

const ArrayItem = memo(({ path, index, schema }: any) => {
   const { value, ...ctx } = useDerivedFieldContext(path, (ctx) => {
      return ctx.value?.[index];
   });
   const itemPath = suffixPath(path, index);
   let subschema = schema.items;
   const itemsMultiSchema = getMultiSchema(schema.items);
   if (itemsMultiSchema) {
      const [, , _subschema] = getMultiSchemaMatched(schema.items, value);
      subschema = _subschema;
   }

   const handleUpdate = useEvent((pointer: string, value: any) => {
      ctx.setValue(pointer, value);
   });

   const handleDelete = useEvent((pointer: string) => {
      ctx.deleteValue(pointer);
   });

   const DeleteButton = useMemo(
      () => <IconButton Icon={IconTrash} onClick={() => handleDelete(itemPath)} size="sm" />,
      [itemPath],
   );

   return (
      <div key={itemPath} className="flex flex-row gap-2">
         <FieldComponent
            required={schema.minItems > 0}
            name={itemPath}
            schema={subschema!}
            value={value}
            onChange={(e) => {
               handleUpdate(itemPath, coerce(e.target.value, subschema!));
            }}
            className="w-full"
         />
         {DeleteButton}
      </div>
   );
}, isEqual);

const ArrayIterator = memo(
   ({ name, children }: any) => {
      return children(useFormValue(name));
   },
   (prev, next) => prev.value?.length === next.value?.length,
);

const ArrayAdd = ({ schema, path }: { schema: JsonSchema; path: string }) => {
   const {
      setValue,
      value: { currentIndex },
      ...ctx
   } = useDerivedFieldContext(path, (ctx) => {
      return { currentIndex: ctx.value?.length ?? 0 };
   });
   const itemsMultiSchema = getMultiSchema(schema.items);

   function handleAdd(template?: any) {
      const newPath = suffixPath(path, currentIndex);
      setValue(newPath, template ?? ctx.lib.getTemplate(undefined, schema!.items));
   }

   if (itemsMultiSchema) {
      return (
         <Dropdown
            dropdownWrapperProps={{
               className: "min-w-0",
            }}
            items={itemsMultiSchema.map((s, i) => ({
               label: s!.title ?? `Option ${i + 1}`,
               onClick: () => handleAdd(ctx.lib.getTemplate(undefined, s!)),
            }))}
            onClickItem={console.log}
         >
            <Button IconLeft={IconLibraryPlus}>Add</Button>
         </Dropdown>
      );
   }

   return <Button onClick={() => handleAdd()}>Add</Button>;
};
