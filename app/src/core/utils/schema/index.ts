import * as s from "jsonv-ts";

export { validator as jsc, type Options } from "jsonv-ts/hono";
export { describeRoute, schemaToSpec, openAPISpecs, info } from "jsonv-ts/hono";
export {
   mcp,
   McpServer,
   Resource,
   Tool,
   mcpTool,
   mcpResource,
   getMcpServer,
   type ToolAnnotation,
   type ToolHandlerCtx,
} from "jsonv-ts/mcp";

export { secret, SecretSchema } from "./secret";

export { s };

export const stripMark = <O extends object>(o: O): O => o;
export const mark = <O extends object>(o: O): O => o;

export const stringIdentifier = s.string({
   pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$",
   minLength: 2,
   maxLength: 150,
});

export class InvalidSchemaError extends Error {
   constructor(
      public schema: s.Schema,
      public value: unknown,
      public errors: s.ErrorDetail[] = [],
   ) {
      super(
         `Invalid schema given for ${JSON.stringify(value, null, 2)}\n\n` +
            `Error: ${JSON.stringify(errors[0], null, 2)}`,
      );
   }

   first() {
      return this.errors[0]!;
   }

   firstToString() {
      const first = this.first();
      return `${first.error} at ${first.instanceLocation}`;
   }
}

export type ParseOptions = {
   withDefaults?: boolean;
   withExtendedDefaults?: boolean;
   coerce?: boolean;
   coerceDropUnknown?: boolean;
   clone?: boolean;
   skipMark?: boolean; // @todo: do something with this
   forceParse?: boolean; // @todo: do something with this
   onError?: (errors: s.ErrorDetail[]) => void;
};

export const cloneSchema = <S extends s.Schema>(schema: S): S => {
   const json = schema.toJSON();
   return s.fromSchema(json) as S;
};

export function parse<S extends s.Schema, Options extends ParseOptions = ParseOptions>(
   _schema: S,
   v: unknown,
   opts?: Options,
): Options extends { coerce: true } ? s.StaticCoerced<S> : s.Static<S> {
   const schema = (opts?.clone ? cloneSchema(_schema as any) : _schema) as s.Schema;
   let value =
      opts?.coerce !== false
         ? schema.coerce(v, { dropUnknown: opts?.coerceDropUnknown ?? false })
         : v;
   if (opts?.withDefaults !== false) {
      value = schema.template(value, {
         withOptional: true,
         withExtendedOptional: opts?.withExtendedDefaults ?? false,
      });
   }

   const result = _schema.validate(value, {
      shortCircuit: true,
      ignoreUnsupported: true,
   });
   if (!result.valid) {
      if (opts?.onError) {
         opts.onError(result.errors);
      } else {
         throw new InvalidSchemaError(schema, v, result.errors);
      }
   }

   return value as any;
}
