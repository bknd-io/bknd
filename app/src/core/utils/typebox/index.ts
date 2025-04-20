import * as tb from "@sinclair/typebox";
import type {
   TypeRegistry,
   Static,
   StaticDecode,
   TSchema,
   SchemaOptions,
   TObject,
} from "@sinclair/typebox";
import {
   DefaultErrorFunction,
   Errors,
   SetErrorFunction,
   type ValueErrorIterator,
} from "@sinclair/typebox/errors";
import { Check, Default, Value, type ValueError } from "@sinclair/typebox/value";

export type RecursivePartial<T> = {
   [P in keyof T]?: T[P] extends (infer U)[]
      ? RecursivePartial<U>[]
      : T[P] extends object | undefined
        ? RecursivePartial<T[P]>
        : T[P];
};

type ParseOptions = {
   useDefaults?: boolean;
   decode?: boolean;
   onError?: (errors: ValueErrorIterator) => void;
   forceParse?: boolean;
   skipMark?: boolean;
};

const validationSymbol = Symbol("tb-parse-validation");

export class TypeInvalidError extends Error {
   errors: ValueError[];
   constructor(
      public schema: tb.TSchema,
      public data: unknown,
      message?: string,
   ) {
      //console.warn("errored schema", JSON.stringify(schema, null, 2));
      super(message ?? `Invalid: ${JSON.stringify(data)}`);
      this.errors = [...Errors(schema, data)];
   }

   first() {
      return this.errors[0]!;
   }

   firstToString() {
      const first = this.first();
      return `${first.message} at "${first.path}"`;
   }

   toJSON() {
      return {
         message: this.message,
         schema: this.schema,
         data: this.data,
         errors: this.errors,
      };
   }
}

export function stripMark<O = any>(obj: O) {
   const newObj = structuredClone(obj);
   mark(newObj, false);
   return newObj as O;
}

export function mark(obj: any, validated = true) {
   if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      if (validated) {
         obj[validationSymbol] = true;
      } else {
         delete obj[validationSymbol];
      }
      for (const key in obj) {
         if (typeof obj[key] === "object" && obj[key] !== null) {
            mark(obj[key], validated);
         }
      }
   }
}

export function parse<Schema extends tb.TSchema = tb.TSchema>(
   schema: Schema,
   data: RecursivePartial<tb.Static<Schema>>,
   options?: ParseOptions,
): tb.Static<Schema> {
   if (!options?.forceParse && typeof data === "object" && validationSymbol in data) {
      if (options?.useDefaults === false) {
         return data as tb.Static<typeof schema>;
      }

      // this is important as defaults are expected
      return Default(schema, data as any) as tb.Static<Schema>;
   }

   const parsed = options?.useDefaults === false ? data : Default(schema, data);

   if (Check(schema, parsed)) {
      options?.skipMark !== true && mark(parsed, true);
      return parsed as tb.Static<typeof schema>;
   } else if (options?.onError) {
      options.onError(Errors(schema, data));
   } else {
      throw new TypeInvalidError(schema, data);
   }

   // @todo: check this
   return undefined as any;
}

export function parseDecode<Schema extends tb.TSchema = tb.TSchema>(
   schema: Schema,
   data: RecursivePartial<tb.StaticDecode<Schema>>,
): tb.StaticDecode<Schema> {
   const parsed = Default(schema, data);

   if (Check(schema, parsed)) {
      return parsed as tb.StaticDecode<typeof schema>;
   }

   throw new TypeInvalidError(schema, data);
}

export function strictParse<Schema extends tb.TSchema = tb.TSchema>(
   schema: Schema,
   data: tb.Static<Schema>,
   options?: ParseOptions,
): tb.Static<Schema> {
   return parse(schema, data as any, options);
}

export function registerCustomTypeboxKinds(registry: typeof TypeRegistry) {
   registry.Set("StringEnum", (schema: any, value: any) => {
      return typeof value === "string" && schema.enum.includes(value);
   });
}
registerCustomTypeboxKinds(tb.TypeRegistry);

export const StringEnum = <const T extends readonly string[]>(
   values: T,
   options?: tb.StringOptions,
) =>
   tb.Type.Unsafe<T[number]>({
      [tb.Kind]: "StringEnum",
      type: "string",
      enum: values,
      ...options,
   });

// key value record compatible with RJSF and typebox inference
// acting like a Record, but using an Object with additionalProperties
export const StringRecord = <T extends tb.TSchema>(properties: T, options?: tb.ObjectOptions) =>
   tb.Type.Object({}, { ...options, additionalProperties: properties }) as unknown as tb.TRecord<
      tb.TString,
      typeof properties
   >;

// fixed value that only be what is given + prefilled
export const Const = <T extends tb.TLiteralValue = tb.TLiteralValue>(
   value: T,
   options?: tb.SchemaOptions,
) =>
   tb.Type.Literal(value, {
      ...options,
      default: value,
      const: value,
      readOnly: true,
   }) as tb.TLiteral<T>;

export const StringIdentifier = tb.Type.String({
   pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$",
   minLength: 2,
   maxLength: 150,
});

export const StrictObject = <T extends tb.TProperties>(
   properties: T,
   options?: tb.ObjectOptions,
): tb.TObject<T> => tb.Type.Object(properties, { ...options, additionalProperties: false });

SetErrorFunction((error) => {
   if (error?.schema?.errorMessage) {
      return error.schema.errorMessage;
   }

   if (error?.schema?.[tb.Kind] === "StringEnum") {
      return `Expected: ${error.schema.enum.map((e) => `"${e}"`).join(", ")}`;
   }

   return DefaultErrorFunction(error);
});

export type { Static, StaticDecode, TSchema, TObject, ValueError, SchemaOptions };

export { Value, Default, Errors, Check };
