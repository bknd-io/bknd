import type { JSONSchema7 } from "json-schema";
import { omitKeys, type s } from "bknd/utils";

export function extractSchema<
   Schema extends s.ObjectSchema,
   Keys extends keyof Schema["properties"],
   Config extends s.Static<Schema>,
>(
   schema: Schema,
   config: Config,
   keys: Keys[],
): [
   JSONSchema7,
   Partial<Config>,
   {
      [K in Keys]: {
         // @ts-ignore
         config: Config[K];
         schema: Schema["properties"][K];
      };
   },
] {
   if (!schema.properties) {
      return [{ ...schema.toJSON() }, config, {} as any];
   }

   const newSchema = JSON.parse(JSON.stringify(schema));
   const updated = {
      ...newSchema,
      properties: omitKeys(newSchema.properties, keys),
   };
   if (updated.required) {
      updated.required = updated.required.filter((key) => !keys.includes(key as any));
   }

   const extracted = {} as any;
   for (const key of keys) {
      extracted[key] = {
         // @ts-ignore
         config: config[key],
         // @ts-ignore
         schema: newSchema.properties[key],
      };
   }

   const reducedConfig = omitKeys(config, keys as string[]) as any;

   return [updated, reducedConfig, extracted];
}
