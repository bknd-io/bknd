import { describe, it, expect } from "bun:test";
import { excludePropertyTypes, rescursiveClean } from "./utils";
import { s } from "../../core/utils/schema";

describe("rescursiveOptional", () => {
   it("should make all properties optional", () => {
      const schema = s.strictObject({
         a: s.string({ default: "a" }),
         b: s.number(),
         nested: s.strictObject({
            c: s.string().optional(),
            d: s.number(),
            nested2: s.record(s.string()),
         }),
      });

      //console.log(schema.toJSON());
      const result = rescursiveClean(schema, {
         removeRequired: true,
         removeDefault: true,
      });
      const json = result.toJSON();

      expect(json.required).toBeUndefined();
      expect(json.properties.a.default).toBeUndefined();
      expect(json.properties.nested.required).toBeUndefined();
      expect(json.properties.nested.properties.nested2.required).toBeUndefined();
   });

   it("should exclude properties", () => {
      const schema = s.strictObject({
         a: s.string(),
         b: s.number(),
      });

      const result = excludePropertyTypes(schema, (instance) => instance instanceof s.StringSchema);
      expect(Object.keys(result).length).toBe(1);
   });
});
