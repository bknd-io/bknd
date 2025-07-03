import { describe, expect, test } from "bun:test";
import { DateField, dateFieldConfigSchema } from "../../../../src/data";
import { fieldTestSuite } from "data/fields/field-test-suite";
import { bunTestRunner } from "adapter/bun/test";

describe("[data] DateField", async () => {
   fieldTestSuite(
      bunTestRunner,
      DateField,
      { defaultValue: new Date(), schemaType: "date" },
      { type: "date" },
   );

   // @todo: add datefield tests
   test("week", async () => {
      const field = new DateField("test", { type: "week" });
      console.log(field.getValue("2021-W01", "submit"));
   });
});
