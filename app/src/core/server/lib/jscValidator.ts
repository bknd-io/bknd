import type { Env, Input, MiddlewareHandler, ValidationTargets } from "hono";
import { validator } from "hono/validator";
import type { Static, TSchema } from "simple-jsonschema-ts";

export const honoValidator = <
   Target extends keyof ValidationTargets,
   E extends Env,
   P extends string,
   const Schema extends TSchema = TSchema,
   Out = Static<Schema>,
   I extends Input = {
      in: { [K in Target]: Static<Schema> };
      out: { [K in Target]: Static<Schema> };
   },
>(
   target: Target,
   schema: Schema,
): MiddlewareHandler<E, P, I> => {
   // @ts-expect-error not typed well
   return validator(target, async (value, c) => {
      const coersed = schema.coerce(value);
      const result = schema.validate(coersed);
      if (!result.valid) {
         return c.json({ ...result, schema }, 400);
      }

      return coersed as Out;
   });
};
