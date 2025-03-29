import { describe, expect, test } from "bun:test";
import { Default, stripMark } from "../../../../src/core/utils";
import { baseFieldConfigSchema, Field } from "../../../../src/data/fields/Field";
import { fieldTestSuite } from "data/fields/field-test-suite";

describe("[data] Field", async () => {
   class FieldSpec extends Field {
      getSchema() {
         return baseFieldConfigSchema;
      }
   }

   test("fieldSpec", () => {
      expect(new FieldSpec("test").schema()).toEqual({
         name: "test",
         type: "text",
         nullable: true, // always true
         dflt: undefined, // never using default value
      });
   });

   fieldTestSuite({ expect, test }, FieldSpec, { defaultValue: "test", schemaType: "text" });

   test("default config", async () => {
      const config = Default(baseFieldConfigSchema, {});
      expect(stripMark(new FieldSpec("test").config)).toEqual(config as any);
   });

   test("transformPersist (specific)", async () => {
      const required = new FieldSpec("test", { required: true });
      const requiredDefault = new FieldSpec("test", {
         required: true,
         default_value: "test",
      });

      expect(required.transformPersist(null, undefined as any, undefined as any)).rejects.toThrow();
      expect(
         required.transformPersist(undefined, undefined as any, undefined as any),
      ).rejects.toThrow();

      // works because it has a default value
      expect(
         requiredDefault.transformPersist(null, undefined as any, undefined as any),
      ).resolves.toBeDefined();
      expect(
         requiredDefault.transformPersist(undefined, undefined as any, undefined as any),
      ).resolves.toBeDefined();
   });
});
