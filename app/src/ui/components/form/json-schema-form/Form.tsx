import {
   type PrimitiveAtom,
   atom,
   getDefaultStore,
   useAtom,
   useAtomValue,
   useSetAtom,
} from "jotai";
import { selectAtom } from "jotai/utils";
import { Draft2019, type JsonError, type JsonSchema as LibJsonSchema } from "json-schema-library";
import type { TemplateOptions as LibTemplateOptions } from "json-schema-library/dist/lib/getTemplate";
import type { JSONSchema as $JSONSchema, FromSchema } from "json-schema-to-ts";
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
   useRef,
} from "react";
import { JsonViewer } from "ui/components/code/JsonViewer";
import { useEvent } from "ui/hooks/use-event";
import { Field } from "./Field";
import {
   getPath,
   isEqual,
   isRequired,
   omitSchema,
   pathToPointer,
   prefixPath,
   prefixPointer,
} from "./utils";

export type JSONSchema = Exclude<$JSONSchema, boolean>;
type FormState<Data = any> = {
   dirty: boolean;
   submitting: boolean;
   errors: JsonError[];
   data: Data;
};

type FormOptions = {
   debug?: boolean;
   keepEmpty?: boolean;
   anyOfNoneSelectedMode?: "none" | "first";
};

export type FormContext<Data> = {
   setData: (data: Data) => void;
   setValue: (pointer: string, value: any) => void;
   deleteValue: (pointer: string) => void;
   errors: JsonError[];
   dirty: boolean;
   submitting: boolean;
   schema: LibJsonSchema;
   lib: Draft2019;
   options: FormOptions;
   root: string;
   _formStateAtom: PrimitiveAtom<FormState<Data>>;
   readOnly: boolean;
};

const FormContext = createContext<FormContext<any>>(undefined!);
FormContext.displayName = "FormContext";

export function Form<
   const Schema extends JSONSchema,
   const Data = Schema extends JSONSchema ? FromSchema<Schema> : any,
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
   beforeSubmit,
   ignoreKeys = [],
   options = {},
   readOnly = false,
   ...props
}: Omit<ComponentPropsWithoutRef<"form">, "onChange" | "onSubmit"> & {
   schema: Schema;
   validateOn?: "change" | "submit";
   initialOpts?: LibTemplateOptions;
   ignoreKeys?: string[];
   onChange?: (data: Partial<Data>, name: string, value: any, context: FormContext<Data>) => void;
   beforeSubmit?: (data: Data) => Data;
   onSubmit?: (data: Data) => void | Promise<void>;
   onInvalidSubmit?: (errors: JsonError[], data: Partial<Data>) => void;
   hiddenSubmit?: boolean;
   options?: FormOptions;
   initialValues?: Schema extends JSONSchema ? FromSchema<Schema> : never;
   readOnly?: boolean;
}) {
   const [schema, initial] = omitSchema(_schema, ignoreKeys, _initialValues);
   const lib = useMemo(() => new Draft2019(schema), [JSON.stringify(schema)]);
   const initialValues = initial ?? lib.getTemplate(undefined, schema, initialOpts);
   const _formStateAtom = useMemo(() => {
      return atom<FormState<Data>>({
         dirty: false,
         submitting: false,
         errors: [] as JsonError[],
         data: initialValues,
      });
   }, [initialValues]);
   const setFormState = useSetAtom(_formStateAtom);
   const formRef = useRef<HTMLFormElement | null>(null);

   useEffect(() => {
      if (initialValues && validateOn === "change") {
         validate();
      }
   }, [initialValues]);

   // @ts-ignore
   async function handleSubmit(e: FormEvent<HTMLFormElement>) {
      const { data, errors } = validate();
      if (onSubmit) {
         e.preventDefault();
         setFormState((prev) => ({ ...prev, submitting: true }));

         try {
            if (errors.length === 0) {
               await onSubmit(data as Data);
            } else {
               console.error("form: invalid", { data, errors });
               onInvalidSubmit?.(errors, data);
            }
         } catch (e) {
            console.warn(e);
         }
         setFormState((prev) => ({ ...prev, submitting: false }));
         return false;
      } else if (errors.length > 0) {
         e.preventDefault();
         onInvalidSubmit?.(errors, data);
         return false;
      }
   }

   const setValue = useEvent((path: string, value: any) => {
      setFormState((state) => {
         const prev = state.data;
         const changed = immutable.set(prev, path, value);
         onChange?.(changed, path, value, context);
         return { ...state, data: changed };
      });
      check();
   });

   const deleteValue = useEvent((path: string) => {
      setFormState((state) => {
         const prev = state.data;
         const changed = immutable.del(prev, path);
         onChange?.(changed, path, undefined, context);
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
      const before = beforeSubmit ?? ((a: any) => a);
      const actual = before((_data as any) ?? getCurrentState()?.data);
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
         root: "",
         path: "",
         readOnly,
      }),
      [schema, initialValues, options, readOnly],
   ) as any;

   return (
      <form {...props} ref={formRef} onSubmit={handleSubmit}>
         <FormContext.Provider value={context}>
            {children ? children : <Field name="" />}
            {options?.debug && <FormDebug />}
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
      /*additional.setValue = (path: string, value: any) => {
         ctx.setValue(prefixPath(path, prefix), value);
      };
      additional.deleteValue = (path: string) => {
         ctx.deleteValue(prefixPath(path, prefix));
      };*/
   }

   const context = {
      ...ctx,
      ...overrides,
      ...additional,
   };

   return <FormContext.Provider value={context}>{children}</FormContext.Provider>;
}

export function useFormValue(name: string, opts?: { strict?: boolean }) {
   const { _formStateAtom, root } = useFormContext();
   if ((typeof name !== "string" || name.length === 0) && opts?.strict === true)
      return { value: undefined, errors: [] };

   const selected = selectAtom(
      _formStateAtom,
      useCallback(
         (state) => {
            const prefixedName = prefixPath(name, root);
            const pointer = pathToPointer(prefixedName);
            return {
               value: getPath(state.data, prefixedName),
               errors: state.errors.filter((error) => error.data.pointer.startsWith(pointer)),
            };
         },
         [name],
      ),
      isEqual,
   );
   return useAtom(selected)[0];
}

export function useFormError(name: string, opt?: { strict?: boolean; debug?: boolean }) {
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
         [name],
      ),
      isEqual,
   );
   return useAtom(selected)[0];
}

export function useFormStateSelector<Data = any, Reduced = Data>(
   selector: (state: FormState<Data>) => Reduced,
   deps: any[] = [],
): Reduced {
   const { _formStateAtom } = useFormContext();
   const selected = selectAtom(_formStateAtom, useCallback(selector, deps), isEqual);
   return useAtom(selected)[0];
}

export type SelectorFn<Ctx = any, Refined = any> = (state: Ctx) => Refined;
export type DeriveFn<Data = any, Reduced = undefined> = SelectorFn<
   FormContext<Data> & {
      pointer: string;
      required: boolean;
      value: any;
      path: string;
   },
   Reduced
>;

export function useDerivedFieldContext<Data = any, Reduced = undefined>(
   path,
   deriveFn?: DeriveFn<Data, Reduced>,
   _schema?: JSONSchema,
): FormContext<Data> & {
   value: Reduced;
   pointer: string;
   required: boolean;
   path: string;
} {
   const { _formStateAtom, root, lib, ...ctx } = useFormContext();
   const schema = _schema ?? ctx.schema;
   const selected = selectAtom(
      _formStateAtom,
      useCallback(
         (state) => {
            const pointer = pathToPointer(path);
            const prefixedName = prefixPath(path, root);
            const prefixedPointer = pathToPointer(prefixedName);
            const value = getPath(state.data, prefixedName);
            const fieldSchema =
               pointer === "#/"
                  ? (schema as LibJsonSchema)
                  : lib.getSchema({ pointer, data: value, schema });
            const required = isRequired(lib, prefixedPointer, schema, state.data);

            const context = {
               ...ctx,
               path: prefixedName,
               root,
               schema: fieldSchema as LibJsonSchema,
               pointer,
               required,
            };
            const derived = deriveFn?.({ ...context, _formStateAtom, lib, value });

            return {
               ...context,
               value: derived,
            };
         },
         [path, schema ?? {}, root],
      ),
      isEqual,
   );
   return {
      ...useAtomValue(selected),
      _formStateAtom,
      lib,
   } as any;
}

export function Subscribe<Data = any, Refined = Data>({
   children,
   selector,
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

   return <JsonViewer json={ctx} expand={99} showCopy />;
}
