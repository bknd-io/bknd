/// <reference types="@cloudflare/workers-types" />

import { describe, test, expect } from "vitest";

import { viTestRunner } from "adapter/node/vitest";
import { connectionTestSuite } from "data/connection/connection-test-suite";
import { Miniflare } from "miniflare";
import { doSqlite } from "./DoConnection";

const script = `
import { DurableObject } from "cloudflare:workers";

export class TestObject extends DurableObject {
    constructor(ctx, env) {
      super(ctx, env);
      this.storage = ctx.storage;
   }
      
   async exec(sql, ...parameters) {
      //return { sql, parameters }
      const cursor = this.storage.sql.exec(sql, ...parameters);
      return {
         rows: cursor.toArray() || [],
         rowsWritten: cursor.rowsWritten,
         rowsRead: cursor.rowsRead,
         databaseSize: this.storage.sql.databaseSize,
      }
   }
      
   async databaseSize() {
      return this.storage.sql.databaseSize;
   }
}
   
export default {
   async fetch(request, env) {
      const stub = env.TEST_OBJECT.get(env.TEST_OBJECT.idFromName("test"));
      return stub.fetch(request);
   }
}
`;

describe("doSqlite", async () => {
   connectionTestSuite(viTestRunner, {
      makeConnection: async () => {
         const mf = new Miniflare({
            modules: true,
            durableObjects: { TEST_OBJECT: { className: "TestObject", useSQLite: true } },
            script,
         });

         const ns = await mf.getDurableObjectNamespace("TEST_OBJECT");
         const id = ns.idFromName("test");
         const stub = ns.get(id) as unknown as DurableObjectStub<
            Rpc.DurableObjectBranded & {
               exec: (sql: string, ...parameters: any[]) => Promise<any>;
            }
         >;

         const stubs: any[] = [];
         const mock = {
            databaseSize: 0,
            exec: async function (sql: string, ...parameters: any[]) {
               // @ts-ignore
               const result = (await stub.exec(sql, ...parameters)) as any;
               this.databaseSize = result.databaseSize;
               stubs.push(result);
               return {
                  toArray: () => result.rows,
                  rowsWritten: result.rowsWritten,
                  rowsRead: result.rowsRead,
               };
            },
         };

         return {
            connection: doSqlite({ sql: mock as any }),
            dispose: async () => {
               await Promise.all(
                  stubs.map((stub) => {
                     try {
                        return stub[Symbol.dispose]();
                     } catch (e) {}
                  }),
               );
               await mf.dispose();
            },
         };
      },
      rawDialectDetails: ["meta.rowsWritten", "meta.rowsRead", "meta.databaseSize"],
   });
});
