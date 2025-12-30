import { Draft2019 } from "json-schema-library";

export function getTemplate(schema: object) {
   if (!schema || schema === undefined || schema === null) return undefined;

   const lib = new Draft2019(schema);
   return lib.getTemplate(undefined, schema);
}
