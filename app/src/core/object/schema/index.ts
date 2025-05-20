import { mergeObject } from "core/utils";

export { jsc, type Options, type Hook } from "./validator";
import * as s from "jsonv-ts";

export { s };

export class InvalidSchemaError extends Error {
   constructor(
      public schema: s.TAnySchema,
      public value: unknown,
      public errors: s.ErrorDetail[] = [],
   ) {
      super(
         `Invalid schema given for ${JSON.stringify(value, null, 2)}\n\n` +
            `Error: ${JSON.stringify(errors[0], null, 2)}`,
      );
   }
}

export type ParseOptions = {
   withDefaults?: boolean;
};

export function parse<S extends s.TAnySchema>(
   _schema: S,
   v: unknown,
   opts: ParseOptions = {},
): s.StaticCoersed<S> {
   const schema = _schema as unknown as s.TSchema;
   const result = schema.validate(v, { shortCircuit: true, ignoreUnsupported: true });
   if (!result.valid) throw new InvalidSchemaError(schema, v, result.errors);
   const coerced = schema.coerce(v);
   if (opts.withDefaults) {
      return mergeObject(schema.template({ withOptional: true }), coerced) as any;
   }

   return coerced as any;
}
