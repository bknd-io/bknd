import {
   Kind,
   type ObjectOptions,
   type SchemaOptions,
   type Static,
   type StaticDecode,
   type StringOptions,
   type TLiteral,
   type TLiteralValue,
   type TObject,
   type TRecord,
   type TSchema,
   type TString,
   Type,
   TypeRegistry,
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
      public schema: TSchema,
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

export function parse<Schema extends TSchema = TSchema>(
   schema: Schema,
   data: RecursivePartial<Static<Schema>>,
   options?: ParseOptions,
): Static<Schema> {
   if (!options?.forceParse && typeof data === "object" && validationSymbol in data) {
      if (options?.useDefaults === false) {
         return data as Static<typeof schema>;
      }

      // this is important as defaults are expected
      return Default(schema, data as any) as Static<Schema>;
   }

   const parsed = options?.useDefaults === false ? data : Default(schema, data);

   if (Check(schema, parsed)) {
      options?.skipMark !== true && mark(parsed, true);
      return parsed as Static<typeof schema>;
   } else if (options?.onError) {
      options.onError(Errors(schema, data));
   } else {
      throw new TypeInvalidError(schema, data);
   }

   // @todo: check this
   return undefined as any;
}

export function parseDecode<Schema extends TSchema = TSchema>(
   schema: Schema,
   data: RecursivePartial<StaticDecode<Schema>>,
): StaticDecode<Schema> {
   const parsed = Default(schema, data);

   if (Check(schema, parsed)) {
      return parsed as StaticDecode<typeof schema>;
   }

   throw new TypeInvalidError(schema, data);
}

export function strictParse<Schema extends TSchema = TSchema>(
   schema: Schema,
   data: Static<Schema>,
   options?: ParseOptions,
): Static<Schema> {
   return parse(schema, data as any, options);
}

export function registerCustomTypeboxKinds(registry: typeof TypeRegistry) {
   registry.Set("StringEnum", (schema: any, value: any) => {
      return typeof value === "string" && schema.enum.includes(value);
   });
}
registerCustomTypeboxKinds(TypeRegistry);

export const StringEnum = <const T extends readonly string[]>(values: T, options?: StringOptions) =>
   Type.Unsafe<T[number]>({
      [Kind]: "StringEnum",
      type: "string",
      enum: values,
      ...options,
   });

// key value record compatible with RJSF and typebox inference
// acting like a Record, but using an Object with additionalProperties
export const StringRecord = <T extends TSchema>(properties: T, options?: ObjectOptions) =>
   Type.Object({}, { ...options, additionalProperties: properties }) as unknown as TRecord<
      TString,
      typeof properties
   >;

// fixed value that only be what is given + prefilled
export const Const = <T extends TLiteralValue = TLiteralValue>(value: T, options?: SchemaOptions) =>
   Type.Literal(value, { ...options, default: value, const: value, readOnly: true }) as TLiteral<T>;

export const StringIdentifier = Type.String({
   pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$",
   minLength: 2,
   maxLength: 150,
});

SetErrorFunction((error) => {
   if (error?.schema?.errorMessage) {
      return error.schema.errorMessage;
   }

   if (error?.schema?.[Kind] === "StringEnum") {
      return `Expected: ${error.schema.enum.map((e) => `"${e}"`).join(", ")}`;
   }

   return DefaultErrorFunction(error);
});

export {
   Type,
   type Static,
   type StaticDecode,
   type TSchema,
   Kind,
   type TObject,
   type ValueError,
   type SchemaOptions,
   Value,
   Default,
   Errors,
   Check,
};
