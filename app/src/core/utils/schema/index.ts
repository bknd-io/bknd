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
   stdioTransport,
   McpClient,
   logLevels as mcpLogLevels,
   type McpClientConfig,
   type ToolAnnotation,
   type ToolHandlerCtx,
} from "jsonv-ts/mcp";

export { secret, SecretSchema } from "./secret";

export { s };

const symbol = Symbol("bknd-validation-mark");

export function stripMark<O = any>(obj: O) {
   const newObj = structuredClone(obj);
   mark(newObj, false);
   return newObj as O;
}

export function mark(obj: any, validated = true) {
   try {
      if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
         if (validated) {
            obj[symbol] = true;
         } else {
            delete obj[symbol];
         }
         for (const key in obj) {
            if (typeof obj[key] === "object" && obj[key] !== null) {
               mark(obj[key], validated);
            }
         }
      }
   } catch (e) {}
}

export function isMarked(obj: any) {
   if (typeof obj !== "object" || obj === null) return false;
   return obj[symbol] === true;
}

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
            `Error: ${JSON.stringify(errors[0], null, 2)}\n\n` +
            `Schema: ${JSON.stringify(schema.toJSON(), null, 2)}`,
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
   if (!opts?.forceParse && !opts?.coerce && isMarked(v)) {
      return v as any;
   }

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
