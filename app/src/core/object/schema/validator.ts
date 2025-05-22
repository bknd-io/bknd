import type { Context, Env, Input, MiddlewareHandler, ValidationTargets } from "hono";
import { validator as honoValidator } from "hono/validator";
import type { Static, StaticCoerced, TAnySchema } from "jsonv-ts";

export type Options = {
   coerce?: boolean;
   includeSchema?: boolean;
};

type ValidationResult = {
   valid: boolean;
   errors: {
      keywordLocation: string;
      instanceLocation: string;
      error: string;
      data?: unknown;
   }[];
};

export type Hook<T, E extends Env, P extends string> = (
   result: { result: ValidationResult; data: T },
   c: Context<E, P>,
) => Response | Promise<Response> | void;

export const validator = <
   // @todo: somehow hono prevents the usage of TSchema
   Schema extends TAnySchema,
   Target extends keyof ValidationTargets,
   E extends Env,
   P extends string,
   Opts extends Options = Options,
   Out = Opts extends { coerce: false } ? Static<Schema> : StaticCoerced<Schema>,
   I extends Input = {
      in: { [K in Target]: Static<Schema> };
      out: { [K in Target]: Out };
   },
>(
   target: Target,
   schema: Schema,
   options?: Opts,
   hook?: Hook<Out, E, P>,
): MiddlewareHandler<E, P, I> => {
   // @ts-expect-error not typed well
   return honoValidator(target, async (_value, c) => {
      const value = options?.coerce !== false ? schema.coerce(_value) : _value;
      // @ts-ignore
      const result = schema.validate(value);
      if (!result.valid) {
         return c.json({ ...result, schema }, 400);
      }

      if (hook) {
         const hookResult = hook({ result, data: value as Out }, c);
         if (hookResult) {
            return hookResult;
         }
      }

      return value as Out;
   });
};

export const jsc = validator;
