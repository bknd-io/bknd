import { describe, afterAll, test, expect, beforeAll } from "vitest";
import { Miniflare } from "miniflare";
import { getBindings, type GetBindingType } from "./bindings";

let mf: Miniflare | undefined;

beforeAll(() => {
   mf = new Miniflare({
      modules: true,
      script: `import { DurableObject } from "cloudflare:workers";
      export default { async fetch() { return new Response(null); } }
      export class TestObject extends DurableObject {}
      export class TestObject2 extends DurableObject {}`,
      r2Buckets: ["BUCKET"],
      d1Databases: ["DB"],
      kvNamespaces: ["KV"],
      durableObjects: {
         DO_SQLITE: { className: "TestObject", useSQLite: true },
         DO_KV: { className: "TestObject2" },
      },
   });
});
afterAll(() => {
   mf?.dispose();
});

describe("bindings", () => {
   test("extracts", async () => {
      const env = {
         ...(await mf!.getBindings()),
         some: "string",
         another: 123,
         array: [1, 2, 3],
      };

      const $getBindingKeys = (type: GetBindingType) => {
         const bindings = getBindings(env, type);
         const keys = bindings?.map((b) => b.key);
         if (!keys || keys.length === 0) {
            console.error(`No ${type} binding found`, { bindings });
            throw new Error(`No ${type} binding found`);
         }
         return keys;
      };

      expect($getBindingKeys("D1Database")).toEqual(["DB"]);
      expect($getBindingKeys("KVNamespace")).toEqual(["KV"]);
      expect($getBindingKeys("DurableObjectNamespace")).toEqual(["DO_SQLITE", "DO_KV"]);
      expect($getBindingKeys("R2Bucket")).toEqual(["BUCKET"]);
   });
});
