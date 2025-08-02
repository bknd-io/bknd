import { isPlainObject, transformObject, s } from "bknd/utils";

export function rescursiveClean(
   input: s.Schema,
   opts?: {
      removeRequired?: boolean;
      removeDefault?: boolean;
   },
): s.Schema {
   const json = input.toJSON();

   const removeRequired = (obj: any) => {
      if (isPlainObject(obj)) {
         if ("required" in obj && opts?.removeRequired) {
            obj.required = undefined;
         }

         if ("default" in obj && opts?.removeDefault) {
            obj.default = undefined;
         }

         if ("properties" in obj && isPlainObject(obj.properties)) {
            for (const key in obj.properties) {
               obj.properties[key] = removeRequired(obj.properties[key]);
            }
         }
      }

      return obj;
   };

   removeRequired(json);
   return s.fromSchema(json);
}

export function excludePropertyTypes(
   input: s.ObjectSchema<any, any>,
   props: (new (...args: any[]) => s.Schema)[],
): s.TProperties {
   const properties = { ...input.properties };

   return transformObject(properties, (value, key) => {
      for (const prop of props) {
         if (value instanceof prop) {
            return undefined;
         }
      }
      return value;
   });
}
