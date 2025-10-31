import { IconLibraryPlus, IconTrash } from "@tabler/icons-react";
import type { JsonSchema } from "json-schema-library";
import { memo, useMemo } from "react";
import { Button } from "ui/components/buttons/Button";
import { IconButton } from "ui/components/buttons/IconButton";
import { Dropdown } from "ui/components/overlay/Dropdown";
import { useEvent } from "ui/hooks/use-event";
import { Field, FieldComponent, type FieldProps } from "./Field";
import { FieldWrapper, type FieldwrapperProps } from "./FieldWrapper";
import { FormContextOverride, useDerivedFieldContext, useFormValue } from "./Form";
import { coerce, getMultiSchema, getMultiSchemaMatched, isEqual, suffixPath } from "./utils";

export type ArrayFieldProps = {
   path?: string;
   labelAdd?: string;
   wrapperProps?: Omit<FieldwrapperProps, "name" | "children">;
};

export const ArrayField = ({
   path = "",
   labelAdd = "Add",
   wrapperProps = { wrapper: "fieldset" },
}: ArrayFieldProps) => {
   const { setValue, pointer, required, schema, ...ctx } = useDerivedFieldContext(path);
   if (!schema || typeof schema === "undefined") return `ArrayField(${path}): no schema ${pointer}`;

   // if unique items with enum
   if (schema.uniqueItems && typeof schema.items === "object" && "enum" in schema.items) {
      return (
         <FieldWrapper {...wrapperProps} name={path} schema={schema}>
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
      <FieldWrapper {...wrapperProps} name={path} schema={schema}>
         <ArrayIterator name={path}>
            {({ value }) =>
               value?.map((v, index: number) => (
                  <ArrayItem key={index} path={path} index={index} schema={schema} />
               ))
            }
         </ArrayIterator>
         <div className="flex flex-row">
            <ArrayAdd path={path} schema={schema} label={labelAdd} />
         </div>
      </FieldWrapper>
   );
};

const ArrayItem = memo(({ path, index, schema }: any) => {
   const {
      value,
      path: absolutePath,
      ...ctx
   } = useDerivedFieldContext(path, (ctx) => {
      return ctx.value?.[index];
   });
   const itemPath = suffixPath(absolutePath, index);
   let subschema = schema.items;
   const itemsMultiSchema = getMultiSchema(schema.items);
   if (itemsMultiSchema) {
      const [, , _subschema] = getMultiSchemaMatched(schema.items, value);
      subschema = _subschema;
   }

   const handleDelete = useEvent((pointer: string) => {
      ctx.deleteValue(pointer);
   });

   const DeleteButton = useMemo(
      () => <IconButton Icon={IconTrash} onClick={() => handleDelete(itemPath)} size="sm" />,
      [itemPath],
   );

   return (
      <FormContextOverride prefix={itemPath} schema={subschema!}>
         <div className="flex flex-row gap-2 w-full">
            {/* another wrap is required for primitive schemas */}
            <AnotherField label={false} />
            {DeleteButton}
         </div>
      </FormContextOverride>
   );
}, isEqual);

const AnotherField = (props: Partial<FieldProps>) => {
   const { value } = useFormValue("");

   const inputProps = {
      // @todo: check, potentially just provide value
      value: ["string", "number", "boolean"].includes(typeof value) ? value : undefined,
   };
   return <Field name={""} label={false} {...props} inputProps={inputProps} />;
};

const ArrayIterator = memo(
   ({ name, children }: any) => {
      return children(useFormValue(name));
   },
   (prev, next) => prev.value?.length === next.value?.length,
);

const ArrayAdd = ({
   schema,
   path: _path,
   label = "Add",
}: { schema: JsonSchema; path: string; label?: string }) => {
   const {
      setValue,
      value: { currentIndex },
      path,
      ...ctx
   } = useDerivedFieldContext(_path, (ctx) => {
      return { currentIndex: ctx.value?.length ?? 0 };
   });
   const itemsMultiSchema = getMultiSchema(schema.items);
   const options = { addOptionalProps: true };

   function handleAdd(template?: any) {
      const newPath = suffixPath(path, currentIndex);
      setValue(newPath, template ?? ctx.lib.getTemplate(undefined, schema!.items, options));
   }

   if (itemsMultiSchema) {
      return (
         <Dropdown
            dropdownWrapperProps={{
               className: "min-w-0",
            }}
            items={itemsMultiSchema.map((s, i) => ({
               label: s!.title ?? `Option ${i + 1}`,
               onClick: () => handleAdd(ctx.lib.getTemplate(undefined, s!, options)),
            }))}
            onClickItem={console.log}
         >
            <Button IconLeft={IconLibraryPlus}>{label}</Button>
         </Dropdown>
      );
   }

   return <Button onClick={() => handleAdd()}>{label}</Button>;
};
