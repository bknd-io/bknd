import { describe, it, expect } from "bun:test";
import { excludePropertyTypes, rescursiveClean } from "./utils";
import { s } from "../../core/utils/schema";

describe("rescursiveOptional", () => {
   it("should make all properties optional", () => {
      const schema = s.strictObject({
         a: s.string(),
         b: s.number(),
         nested: s.strictObject({
            c: s.string().optional(),
            d: s.number(),
            nested2: s.record(s.string()),
         }),
      });

      //console.log(schema.toJSON());
      console.log(
         rescursiveClean(schema, {
            removeRequired: true,
            removeDefault: true,
         }).toJSON(),
      );
      /* const result = rescursiveOptional(schema);
      expect(result.properties.a.optional).toBe(true); */
   });

   it("should exclude properties", () => {
      const schema = s.strictObject({
         a: s.string(),
         b: s.number(),
      });

      console.log(excludePropertyTypes(schema, [s.StringSchema]));
   });
});
