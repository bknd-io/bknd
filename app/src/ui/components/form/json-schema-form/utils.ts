import { autoFormatString, omitKeys } from "bknd/utils";
import { type Draft, Draft2019, type JsonSchema } from "json-schema-library";
import type { JSONSchema } from "json-schema-to-ts";
import type { JSONSchemaType } from "json-schema-to-ts/lib/types/definitions/jsonSchema";

export { isEqual, getPath } from "bknd/utils";

export function isNotDefined(value: any) {
   return value === null || value === undefined || value === "";
}

export function coerce(value: any, schema: JsonSchema, opts?: { required?: boolean }) {
   if (isNotDefined(value) && typeof opts?.required === "boolean" && !opts.required) {
      return undefined;
   }

   switch (schema.type) {
      case "string":
         return String(value);
      case "integer":
      case "number":
         return Number(value);
      case "boolean":
         return ["true", "1", 1, "on", true].includes(value);
      case "null":
         return null;
   }

   return value;
}

const PathFilter = (value: any) => typeof value !== "undefined" && value !== null && value !== "";

export function pathToPointer(path: string) {
   const p = path.includes(".") ? path.split(".") : [path];
   return (
      "#" +
      p
         .filter(PathFilter)
         .map((part) => "/" + part)
         .join("")
   );
}

export function prefixPointer(pointer: string, prefix: string) {
   const p = pointer.replace("#", "").split("/");
   return "#" + p.map((part, i) => (i === 1 ? prefix : part)).join("/");
}

export function prefixPath(path: string = "", prefix: string | number = "") {
   const p = path.includes(".") ? path.split(".") : [path];
   return [prefix, ...p].filter(PathFilter).join(".");
}

export function suffixPath(path: string = "", suffix: string | number = "") {
   const p = path.includes(".") ? path.split(".") : [path];
   return [...p, suffix].filter(PathFilter).join(".");
}

export function getParentPointer(pointer: string) {
   return pointer.substring(0, pointer.lastIndexOf("/"));
}

export function isRequired(lib: Draft, pointer: string, schema: JsonSchema, data?: any) {
   if (pointer === "#/" || !schema) {
      return false;
   }

   const childSchema = lib.getSchema({ pointer, data, schema });
   if (typeof childSchema === "object" && "const" in childSchema) {
      return true;
   }

   const parentPointer = getParentPointer(pointer);
   const parentSchema = lib.getSchema({ pointer: parentPointer, data });
   const required = parentSchema?.required?.includes(pointer.split("/").pop()!);

   return !!required;
}

export type IsTypeType =
   | JSONSchemaType
   | JSONSchemaType[]
   | readonly JSONSchemaType[]
   | string
   | undefined;
export function isType(type: IsTypeType, compare: IsTypeType) {
   if (!type || !compare) return false;
   const _type = Array.isArray(type) ? type : [type];
   const _compare = Array.isArray(compare) ? compare : [compare];
   return _compare.some((t) => _type.includes(t));
}

export function getLabel(name: string, schema: JsonSchema) {
   if (typeof schema === "object" && "title" in schema) return schema.title;
   if (!name) return "";
   const label = name.includes(".") ? (name.split(".").pop() ?? "") : name;
   return autoFormatString(label);
}

export function getMultiSchema(schema: JsonSchema): JsonSchema[] | undefined {
   if (!schema || typeof schema !== "object") return;
   return (schema.anyOf ?? schema.oneOf) as any;
}

export function getMultiSchemaMatched(
   schema: JsonSchema,
   data: any,
): [number, JsonSchema[], JsonSchema | undefined] {
   const multiSchema = getMultiSchema(schema);
   //console.log("getMultiSchemaMatched", schema, data, multiSchema);
   if (!multiSchema) return [-1, [], undefined];
   const index = multiSchema.findIndex((subschema) => {
      const lib = new Draft2019(subschema as any);
      return lib.validate(data, subschema).length === 0;
   });
   if (index === -1) return [-1, multiSchema, undefined];

   return [index, multiSchema, multiSchema[index]];
}

export function omitSchema<Given extends JSONSchema>(_schema: Given, keys: string[], _data?: any) {
   if (typeof _schema !== "object" || !("properties" in _schema) || keys.length === 0)
      return [_schema, _data];
   const schema = JSON.parse(JSON.stringify(_schema));
   const data = _data ? JSON.parse(JSON.stringify(_data)) : undefined;

   const updated = {
      ...schema,
      properties: omitKeys(schema.properties, keys),
   };
   if (updated.required) {
      updated.required = updated.required.filter((key) => !keys.includes(key as any));
   }

   const reducedConfig = omitKeys(data, keys) as any;

   return [updated, reducedConfig];
}

export function isTypeSchema(schema?: JsonSchema): schema is JsonSchema {
   return typeof schema === "object" && "type" in schema && !isType(schema.type, "error");
}

export function firstDefined<T>(...args: T[]): T | undefined {
   for (const arg of args) {
      if (typeof arg !== "undefined") return arg;
   }
   return undefined;
}
