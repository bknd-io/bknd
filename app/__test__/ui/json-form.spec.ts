import { describe, expect, test } from "bun:test";
import { Draft2019 } from "json-schema-library";
import type { JSONSchema } from "json-schema-to-ts";
import * as utils from "../../src/ui/components/form/json-schema-form/utils";
import type { IsTypeType } from "../../src/ui/components/form/json-schema-form/utils";

describe("json form", () => {
   test("coerse", () => {
      const examples = [
         ["test", { type: "string" }, "test"],
         ["1", { type: "integer" }, 1],
         ["1", { type: "number" }, 1],
         ["true", { type: "boolean" }, true],
         ["false", { type: "boolean" }, false],
         ["1", { type: "boolean" }, true],
         ["0", { type: "boolean" }, false],
         ["on", { type: "boolean" }, true],
         ["off", { type: "boolean" }, false],
         ["null", { type: "null" }, null],
      ] satisfies [string, Exclude<JSONSchema, boolean>, any][];

      for (const [input, schema, output] of examples) {
         expect(utils.coerce(input, schema)).toBe(output);
      }
   });

   test("isType", () => {
      const examples = [
         ["string", "string", true],
         ["integer", "number", false],
         ["number", "number", true],
         ["boolean", "boolean", true],
         ["null", "null", true],
         ["object", "object", true],
         ["array", "array", true],
         ["object", "array", false],
         [["string", "number"], "number", true],
         ["number", ["string", "number"], true],
      ] satisfies [IsTypeType, IsTypeType, boolean][];

      for (const [type, schemaType, output] of examples) {
         expect(utils.isType(type, schemaType)).toBe(output);
      }
   });

   test("getParentPointer", () => {
      const examples = [
         ["#/nested/property/0/name", "#/nested/property/0"],
         ["#/nested/property/0", "#/nested/property"],
         ["#/nested/property", "#/nested"],
         ["#/nested", "#"],
      ];

      for (const [input, output] of examples) {
         expect(utils.getParentPointer(input)).toBe(output);
      }
   });

   test("isRequired", () => {
      const examples = [
         [
            "#/description",
            { type: "object", properties: { description: { type: "string" } } },
            false,
         ],
         [
            "#/description",
            {
               type: "object",
               required: ["description"],
               properties: { description: { type: "string" } },
            },
            true,
         ],
         [
            "#/nested/property",
            {
               type: "object",
               properties: {
                  nested: {
                     type: "object",
                     properties: { property: { type: "string" } },
                  },
               },
            },
            false,
         ],
         [
            "#/nested/property",
            {
               type: "object",
               properties: {
                  nested: {
                     type: "object",
                     required: ["property"],
                     properties: { property: { type: "string" } },
                  },
               },
            },
            true,
         ],
      ] satisfies [string, Exclude<JSONSchema, boolean>, boolean][];

      for (const [pointer, schema, output] of examples) {
         expect(utils.isRequired(new Draft2019(schema), pointer, schema), `${pointer} `).toBe(
            output,
         );
      }
   });

   test("prefixPath", () => {
      const examples = [
         ["normal", "", "normal"],
         ["", "prefix", "prefix"],
         ["tags", "0", "0.tags"],
         ["tags", 0, "0.tags"],
         ["nested.property", "prefix", "prefix.nested.property"],
         ["nested.property", "", "nested.property"],
      ] satisfies [string, any, string][];

      for (const [path, prefix, output] of examples) {
         expect(utils.prefixPath(path, prefix)).toBe(output);
      }
   });

   test("suffixPath", () => {
      const examples = [
         ["normal", "", "normal"],
         ["", "suffix", "suffix"],
         ["tags", "0", "tags.0"],
         ["tags", 0, "tags.0"],
         ["nested.property", "suffix", "nested.property.suffix"],
         ["nested.property", "", "nested.property"],
      ] satisfies [string, any, string][];

      for (const [path, suffix, output] of examples) {
         expect(utils.suffixPath(path, suffix)).toBe(output);
      }
   });
});
