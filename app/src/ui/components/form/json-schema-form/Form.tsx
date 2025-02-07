import {
   type PrimitiveAtom,
   atom,
   getDefaultStore,
   useAtom,
   useAtomValue,
   useSetAtom
} from "jotai";
import { selectAtom } from "jotai/utils";
import { Draft2019, type JsonError, type JsonSchema as LibJsonSchema } from "json-schema-library";
import type { TemplateOptions as LibTemplateOptions } from "json-schema-library/dist/lib/getTemplate";
import type { JSONSchema as $JSONSchema, FromSchema } from "json-schema-to-ts";
import { get, isEqual } from "lodash-es";
import * as immutable from "object-path-immutable";
import {
   type ComponentPropsWithoutRef,
   type FormEvent,
   type ReactNode,
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useRef
} from "react";
import { JsonViewer } from "ui/components/code/JsonViewer";
import { useEvent } from "ui/hooks/use-event";
import { Field } from "./Field";
import {
   isRequired,
   normalizePath,
   omitSchema,
   pathToPointer,
   prefixPath,
   prefixPointer
} from "./utils";

type JSONSchema = Exclude<$JSONSchema, boolean>;
type FormState<Data = any> = {
   dirty: boolean;
   submitting: boolean;
   errors: JsonError[];
   data: Data;
};

export type FormProps<
   Schema extends JSONSchema = JSONSchema,
   Data = Schema extends JSONSchema ? FromSchema<JSONSchema> : any
> = Omit<ComponentPropsWithoutRef<"form">, "onChange"> & {
   schema: Schema;
   validateOn?: "change" | "submit";
   initialValues?: Partial<Data>;
   initialOpts?: LibTemplateOptions;
   ignoreKeys?: string[];
   onChange?: (data: Partial<Data>, name: string, value: any) => void;
   onSubmit?: (data: Partial<Data>) => void | Promise<void>;
   onInvalidSubmit?: (errors: JsonError[], data: Partial<Data>) => void;
   hiddenSubmit?: boolean;
   options?: {
      debug?: boolean;
      keepEmpty?: boolean;
   };
};

export type FormContext<Data> = {
   data: Data;
   setData: (data: Data) => void;
   setValue: (pointer: string, value: any) => void;
   deleteValue: (pointer: string) => void;
   errors: JsonError[];
   dirty: boolean;
   submitting: boolean;
   schema: JSONSchema;
   lib: Draft2019;
   options: FormProps["options"];
   root: string;
   _formStateAtom: PrimitiveAtom<FormState<Data>>;
};

const FormContext = createContext<FormContext<any>>(undefined!);
FormContext.displayName = "FormContext";

export function Form<
   Schema extends JSONSchema = JSONSchema,
   Data = Schema extends JSONSchema ? FromSchema<JSONSchema> : any
>({
   schema: _schema,
   initialValues: _initialValues,
   initialOpts,
   children,
   onChange,
   onSubmit,
   onInvalidSubmit,
   validateOn = "submit",
   hiddenSubmit = true,
   ignoreKeys = [],
   options = {},
   ...props
}: FormProps<Schema, Data>) {
   const [schema, initial] = omitSchema(_schema, ignoreKeys, _initialValues);
   const lib = useMemo(() => new Draft2019(schema), [JSON.stringify(schema)]);
   const initialValues = initial ?? lib.getTemplate(undefined, schema, initialOpts);
   const _formStateAtom = useMemo(() => {
      return atom<FormState<Data>>({
         dirty: false,
         submitting: false,
         errors: [] as JsonError[],
         data: initialValues
      });
   }, [initialValues]);
   const setFormState = useSetAtom(_formStateAtom);
   const formRef = useRef<HTMLFormElement | null>(null);

   useEffect(() => {
      if (initialValues) {
         validate();
      }
   }, [initialValues]);

   // @ts-ignore
   async function handleSubmit(e: FormEvent<HTMLFormElement>) {
      if (onSubmit) {
         e.preventDefault();
         setFormState((prev) => ({ ...prev, submitting: true }));

         try {
            const { data, errors } = validate();
            if (errors.length === 0) {
               await onSubmit(data);
            } else {
               console.log("invalid", errors);
               onInvalidSubmit?.(errors, data);
            }
         } catch (e) {
            console.warn(e);
         }
         setFormState((prev) => ({ ...prev, submitting: false }));
         return false;
      }
   }

   const setValue = useEvent((pointer: string, value: any) => {
      const normalized = normalizePath(pointer);
      const key = normalized.substring(2).replace(/\//g, ".");
      setFormState((state) => {
         const prev = state.data;
         const changed = immutable.set(prev, key, value);
         onChange?.(changed, key, value);
         return { ...state, data: changed };
      });
      check();
   });

   const deleteValue = useEvent((pointer: string) => {
      const normalized = normalizePath(pointer);
      const key = normalized.substring(2).replace(/\//g, ".");
      setFormState((state) => {
         const prev = state.data;
         const changed = immutable.del(prev, key);
         onChange?.(changed, key, undefined);
         return { ...state, data: changed };
      });
      check();
   });

   const getCurrentState = useEvent(() => getDefaultStore().get(_formStateAtom));

   const check = useEvent(() => {
      const state = getCurrentState();
      setFormState((prev) => ({ ...prev, dirty: !isEqual(initialValues, state.data) }));

      if (validateOn === "change") {
         validate();
      } else if (state?.errors?.length > 0) {
         validate();
      }
   });

   const validate = useEvent((_data?: Partial<Data>) => {
      const actual = _data ?? getCurrentState()?.data;
      const errors = lib.validate(actual, schema);
      setFormState((prev) => ({ ...prev, errors }));
      return { data: actual, errors };
   });

   const context = useMemo(
      () => ({
         _formStateAtom,
         setValue,
         deleteValue,
         schema,
         lib,
         options,
         root: ""
      }),
      [schema, initialValues]
   ) as any;

   return (
      <form {...props} ref={formRef} onSubmit={handleSubmit}>
         <FormContext.Provider value={context}>
            {children ? children : <Field name="" />}
         </FormContext.Provider>
         {hiddenSubmit && (
            <button style={{ visibility: "hidden" }} type="submit">
               Submit
            </button>
         )}
      </form>
   );
}

export function useFormContext() {
   return useContext(FormContext);
}

export function FormContextOverride({
   children,
   overrideData,
   prefix,
   ...overrides
}: Partial<FormContext<any>> & { children: ReactNode; prefix?: string; overrideData?: boolean }) {
   const ctx = useFormContext();
   const additional: Partial<FormContext<any>> = {};

   // this makes a local schema down the three
   // especially useful for AnyOf, since it doesn't need to fully validate (e.g. pattern)
   if (prefix) {
      additional.root = prefix;
      additional.setValue = (pointer: string, value: any) => {
         ctx.setValue(prefixPointer(pointer, prefix), value);
      };
      additional.deleteValue = (pointer: string) => {
         ctx.deleteValue(prefixPointer(pointer, prefix));
      };
   }

   const context = {
      ...ctx,
      ...overrides,
      ...additional
   };

   return <FormContext.Provider value={context}>{children}</FormContext.Provider>;
}

export function useFormValue(name: string) {
   const { _formStateAtom, root } = useFormContext();
   const selected = selectAtom(
      _formStateAtom,
      useCallback(
         (state) => {
            const prefixedName = prefixPath(name, root);
            const pointer = pathToPointer(prefixedName);
            return {
               value: get(state.data, prefixedName),
               errors: state.errors.filter((error) => error.data.pointer.startsWith(pointer))
            };
         },
         [name]
      ),
      isEqual
   );
   return useAtom(selected)[0];
}

export function useFormError(name: string, opt?: { strict?: boolean }) {
   const { _formStateAtom, root } = useFormContext();
   const selected = selectAtom(
      _formStateAtom,
      useCallback(
         (state) => {
            const prefixedName = prefixPath(name, root);
            const pointer = pathToPointer(prefixedName);
            return state.errors.filter((error) => {
               return opt?.strict
                  ? error.data.pointer === pointer
                  : error.data.pointer.startsWith(pointer);
            });
         },
         [name]
      ),
      isEqual
   );
   return useAtom(selected)[0];
}

export function useFormStateSelector<Data = any, Reduced = Data>(
   selector: (state: FormState<Data>) => Reduced
): Reduced {
   const { _formStateAtom } = useFormContext();
   const selected = selectAtom(_formStateAtom, useCallback(selector, []), isEqual);
   return useAtom(selected)[0];
}

type SelectorFn<Ctx = any, Refined = any> = (state: Ctx) => Refined;

export function useDerivedFieldContext<Data = any, Reduced = undefined>(
   path,
   _schema?: LibJsonSchema,
   deriveFn?: SelectorFn<
      FormContext<Data> & {
         pointer: string;
         required: boolean;
         errors: JsonError[];
         value: any;
      },
      Reduced
   >
): FormContext<Data> & { value: Reduced; pointer: string; required: boolean; errors: JsonError[] } {
   const { _formStateAtom, root, lib, ...ctx } = useFormContext();
   const schema = _schema ?? ctx.schema;
   const selected = selectAtom(
      _formStateAtom,
      useCallback(
         (state) => {
            const pointer = pathToPointer(path);
            const prefixedName = prefixPath(path, root);
            const prefixedPointer = pathToPointer(prefixedName);
            const value = get(state.data, prefixedName);
            const errors = state.errors.filter((error) =>
               error.data.pointer.startsWith(prefixedPointer)
            );
            const fieldSchema =
               pointer === "#/"
                  ? (schema as LibJsonSchema)
                  : lib.getSchema({ pointer, data: value, schema });
            const required = isRequired(prefixedPointer, schema, state.data);

            const context = {
               ...ctx,
               root,
               schema: fieldSchema as LibJsonSchema,
               pointer,
               required,
               errors
            };
            const derived = deriveFn?.({ ...context, _formStateAtom, lib, value });

            return {
               ...context,
               value: derived
            };
         },
         [path, schema ?? {}, root]
      ),
      isEqual
   );
   return {
      ...useAtomValue(selected),
      _formStateAtom,
      lib
   } as any;
}

export function Subscribe<Data = any, Refined = Data>({
   children,
   selector
}: {
   children: (state: Refined) => ReactNode;
   selector?: SelectorFn<FormState<Data>, Refined>;
}) {
   return children(useFormStateSelector(selector ?? ((state) => state as unknown as Refined)));
}

export function FormDebug({ force = false }: { force?: boolean }) {
   const { options } = useFormContext();
   if (options?.debug !== true && force !== true) return null;
   const ctx = useFormStateSelector((s) => s);

   return <JsonViewer json={ctx} expand={99} />;
}
