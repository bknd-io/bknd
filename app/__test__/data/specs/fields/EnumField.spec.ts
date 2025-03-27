import { describe, expect, test } from "bun:test";
import { EnumField } from "../../../../src/data";
import { fieldTestSuite, transformPersist } from "data/fields/field-test-suite";

function options(strings: string[]) {
   return { type: "strings", values: strings };
}

describe("[data] EnumField", async () => {
   fieldTestSuite(
      { expect, test },
      // @ts-ignore
      EnumField,
      { defaultValue: "a", schemaType: "text" },
      { options: options(["a", "b", "c"]) },
   );

   test("yields if default value is not a valid option", async () => {
      expect(
         // @ts-ignore
         () => new EnumField("test", { options: options(["a", "b"]), default_value: "c" }),
      ).toThrow();
   });

   test("transformPersist (config)", async () => {
      // @ts-ignore
      const field = new EnumField("test", { options: options(["a", "b", "c"]) });

      expect(transformPersist(field, null)).resolves.toBeUndefined();
      expect(transformPersist(field, "a")).resolves.toBe("a");
      expect(transformPersist(field, "d")).rejects.toThrow();
   });

   test("transformRetrieve", async () => {
      const field = new EnumField("test", {
         // @ts-ignore
         options: options(["a", "b", "c"]),
         default_value: "a",
         required: true,
      });

      expect(field.transformRetrieve(null)).toBe("a");
      expect(field.transformRetrieve("d")).toBe("a");
   });
});
