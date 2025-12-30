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
   props: (instance: s.Schema | unknown) => boolean,
): s.TProperties {
   const properties = { ...input.properties };

   return transformObject(properties, (value, key) => {
      if (props(value)) {
         return undefined;
      }

      return value;
   });
}
