import type { JSONSchema } from "json-schema-to-ts";
import { type ChangeEvent, type ReactNode, createContext, useContext, useState } from "react";
import * as Formy from "ui/components/form/Formy";
import { FieldComponent, Field as FormField, type FieldProps as FormFieldProps } from "./Field";
import { useFieldContext } from "./Form";
import { getLabel, getMultiSchemaMatched } from "./utils";

export type AnyOfFieldRootProps = {
   path?: string;
   schema?: Exclude<JSONSchema, boolean>;
   children: ReactNode;
};

export type AnyOfFieldContext = {
   path: string;
   schema: Exclude<JSONSchema, boolean>;
   schemas?: JSONSchema[];
   selectedSchema?: Exclude<JSONSchema, boolean>;
   selected: number | null;
   select: (index: number | null) => void;
   options: string[];
   selectSchema: any;
};

const AnyOfContext = createContext<AnyOfFieldContext>(undefined!);

export const useAnyOfContext = () => {
   const ctx = useContext(AnyOfContext);
   if (!ctx) throw new Error("useAnyOfContext: no context");
   return ctx;
};

export const Root = ({ path = "", schema: _schema, children }: AnyOfFieldRootProps) => {
   const { setValue, pointer, lib, value, ...ctx } = useFieldContext(path);
   const schema = _schema ?? ctx.schema;
   if (!schema) return `AnyOfField(${path}): no schema ${pointer}`;
   const [matchedIndex, schemas = []] = getMultiSchemaMatched(schema, value);
   const [selected, setSelected] = useState<number | null>(matchedIndex > -1 ? matchedIndex : null);
   const options = schemas.map((s, i) => s.title ?? `Option ${i + 1}`);
   const selectSchema = {
      enum: options
   };

   const selectedSchema =
      selected !== null ? (schemas[selected] as Exclude<JSONSchema, boolean>) : undefined;

   function select(index: number | null) {
      setValue(pointer, index !== null ? lib.getTemplate(undefined, schemas[index]) : undefined);
      setSelected(index);
   }

   return (
      <AnyOfContext.Provider
         value={{ selected, select, options, selectSchema, path, schema, schemas, selectedSchema }}
      >
         {children}
      </AnyOfContext.Provider>
   );
};

export const Select = () => {
   const { selected, select, path, schema, selectSchema } = useAnyOfContext();

   function handleSelect(e: ChangeEvent<HTMLInputElement>) {
      console.log("selected", e.target.value);
      const i = e.target.value ? Number(e.target.value) : null;
      select(i);
   }

   return (
      <>
         <Formy.Label>{getLabel(path, schema)}</Formy.Label>
         <FieldComponent
            schema={selectSchema as any}
            onChange={handleSelect}
            value={selected ?? undefined}
            className="h-8 py-1"
         />
      </>
   );
};

export const Field = ({ name, label, ...props }: Partial<FormFieldProps>) => {
   const { selected, selectedSchema, path } = useAnyOfContext();
   if (selected === null) return null;
   return (
      <FormField
         key={`${path}_${selected}`}
         schema={selectedSchema}
         name={path}
         label={false}
         {...props}
      />
   );
};

export const AnyOf = {
   Root,
   Select,
   Field,
   useContext: useAnyOfContext
};

export const AnyOfField = (props: Omit<AnyOfFieldRootProps, "children">) => {
   return (
      <fieldset>
         <AnyOf.Root {...props}>
            <legend className="flex flex-row gap-2 items-center py-2">
               <AnyOf.Select />
            </legend>
            <AnyOf.Field />
         </AnyOf.Root>
      </fieldset>
   );
};
