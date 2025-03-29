import { describe, expect, test } from "bun:test";
import { JsonSchemaField } from "../../../../src/data";
import { fieldTestSuite } from "data/fields/field-test-suite";

describe("[data] JsonSchemaField", async () => {
   // @ts-ignore
   fieldTestSuite({ expect, test }, JsonSchemaField, { defaultValue: {}, schemaType: "text" });

   // @todo: add JsonSchemaField tests
});
