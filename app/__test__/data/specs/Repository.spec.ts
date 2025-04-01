import { afterAll, describe, expect, test } from "bun:test";
import type { Kysely, Transaction } from "kysely";
import { Perf } from "../../../src/core/utils";
import {
   Entity,
   EntityManager,
   LibsqlConnection,
   ManyToOneRelation,
   RepositoryEvents,
   TextField,
} from "../../../src/data";
import { getDummyConnection } from "../helper";

type E = Kysely<any> | Transaction<any>;

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterAll(afterAllCleanup);

async function sleep(ms: number) {
   return new Promise((resolve) => {
      setTimeout(resolve, ms);
   });
}

describe("[Repository]", async () => {
   test.skip("bulk", async () => {
      //const connection = dummyConnection;
      //const connection = getLocalLibsqlConnection();
      const credentials = null as any; // @todo: determine what to do here
      const connection = new LibsqlConnection(credentials);

      const em = new EntityManager([], connection);
      /*const emLibsql = new EntityManager([], {
         url: connection.url.replace("https", "libsql"),
         authToken: connection.authToken,
      });*/
      const table = "posts";

      const client = connection.getClient();
      if (!client) {
         console.log("Cannot perform test without libsql connection");
         return;
      }

      const conn = em.connection.kysely;
      const selectQ = (e: E) => e.selectFrom(table).selectAll().limit(2);
      const countQ = (e: E) => e.selectFrom(table).select(e.fn.count("*").as("count"));

      async function executeTransaction(em: EntityManager<any>) {
         return await em.connection.kysely.transaction().execute(async (e) => {
            const res = await selectQ(e).execute();
            const count = await countQ(e).execute();

            return [res, count];
         });
      }

      async function executeBatch(em: EntityManager<any>) {
         const queries = [selectQ(conn), countQ(conn)];
         return await em.connection.batchQuery(queries);
      }

      async function executeSingleKysely(em: EntityManager<any>) {
         const res = await selectQ(conn).execute();
         const count = await countQ(conn).execute();
         return [res, count];
      }

      async function executeSingleClient(em: EntityManager<any>) {
         const q1 = selectQ(conn).compile();
         const res = await client.execute({
            sql: q1.sql,
            args: q1.parameters as any,
         });

         const q2 = countQ(conn).compile();
         const count = await client.execute({
            sql: q2.sql,
            args: q2.parameters as any,
         });
         return [res, count];
      }

      const transaction = await executeTransaction(em);
      const batch = await executeBatch(em);

      expect(batch).toEqual(transaction as any);

      const testperf = false;
      if (testperf) {
         const times = 5;

         const exec = async (
            name: string,
            fn: (em: EntityManager<any>) => Promise<any>,
            em: EntityManager<any>,
         ) => {
            const res = await Perf.execute(() => fn(em), times);
            await sleep(1000);
            const info = {
               name,
               total: res.total.toFixed(2),
               avg: (res.total / times).toFixed(2),
               first: res.marks[0].time.toFixed(2),
               last: res.marks[res.marks.length - 1].time.toFixed(2),
            };
            console.log(info.name, info, res.marks);
            return info;
         };

         const data: any[] = [];
         data.push(await exec("transaction.http", executeTransaction, em));
         data.push(await exec("bulk.http", executeBatch, em));
         data.push(await exec("singleKy.http", executeSingleKysely, em));
         data.push(await exec("singleCl.http", executeSingleClient, em));

         /*data.push(await exec("transaction.libsql", executeTransaction, emLibsql));
         data.push(await exec("bulk.libsql", executeBatch, emLibsql));
         data.push(await exec("singleKy.libsql", executeSingleKysely, emLibsql));
         data.push(await exec("singleCl.libsql", executeSingleClient, emLibsql));*/

         console.table(data);
         /**
          * ┌───┬────────────────────┬────────┬────────┬────────┬────────┐
          * │   │ name               │ total  │ avg    │ first  │ last   │
          * ├───┼────────────────────┼────────┼────────┼────────┼────────┤
          * │ 0 │ transaction.http   │ 681.29 │ 136.26 │ 136.46 │ 396.09 │
          * │ 1 │ bulk.http          │ 164.82 │ 32.96  │ 32.95  │ 99.91  │
          * │ 2 │ singleKy.http      │ 330.01 │ 66.00  │ 65.86  │ 195.41 │
          * │ 3 │ singleCl.http      │ 326.17 │ 65.23  │ 61.32  │ 198.08 │
          * │ 4 │ transaction.libsql │ 856.79 │ 171.36 │ 132.31 │ 595.24 │
          * │ 5 │ bulk.libsql        │ 180.63 │ 36.13  │ 35.39  │ 107.71 │
          * │ 6 │ singleKy.libsql    │ 347.11 │ 69.42  │ 65.00  │ 207.14 │
          * │ 7 │ singleCl.libsql    │ 328.60 │ 65.72  │ 62.19  │ 195.04 │
          * └───┴────────────────────┴────────┴────────┴────────┴────────┘
          */
      }
   });

   test("count & exists", async () => {
      const items = new Entity("items", [new TextField("label")]);
      const em = new EntityManager([items], dummyConnection);

      await em.connection.kysely.schema
         .createTable("items")
         .ifNotExists()
         .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
         .addColumn("label", "text")
         .execute();

      // fill
      await em.connection.kysely
         .insertInto("items")
         .values([{ label: "a" }, { label: "b" }, { label: "c" }])
         .execute();

      // count all
      const res = await em.repository(items).count();
      expect(res.sql).toBe('select count(*) as "count" from "items"');
      expect(res.count).toBe(3);

      // count filtered
      const res2 = await em.repository(items).count({ label: { $in: ["a", "b"] } });

      expect(res2.sql).toBe('select count(*) as "count" from "items" where "label" in (?, ?)');
      expect(res2.parameters).toEqual(["a", "b"]);
      expect(res2.count).toBe(2);

      // check exists
      const res3 = await em.repository(items).exists({ label: "a" });
      expect(res3.exists).toBe(true);

      const res4 = await em.repository(items).exists({ label: "d" });
      expect(res4.exists).toBe(false);

      // for now, allow empty filter
      const res5 = await em.repository(items).exists({});
      expect(res5.exists).toBe(true);
   });
});

describe("[data] Repository (Events)", async () => {
   const items = new Entity("items", [new TextField("label")]);
   const categories = new Entity("categories", [new TextField("label")]);
   const em = new EntityManager([items, categories], dummyConnection, [
      new ManyToOneRelation(categories, items),
   ]);
   await em.schema().sync({ force: true });
   const events = new Map<string, any>();

   em.repository(items).emgr.onAny((event) => {
      // @ts-ignore
      events.set(event.constructor.slug, event);
   });
   em.repository(categories).emgr.onAny((event) => {
      // @ts-ignore
      events.set(event.constructor.slug, event);
   });

   test("events were fired", async () => {
      const repo = em.repository(items);
      await repo.findId(1);
      await repo.emgr.executeAsyncs();
      expect(events.has(RepositoryEvents.RepositoryFindOneBefore.slug)).toBeTrue();
      expect(events.has(RepositoryEvents.RepositoryFindOneAfter.slug)).toBeTrue();
      events.clear();

      await repo.findOne({ id: 1 });
      await repo.emgr.executeAsyncs();
      expect(events.has(RepositoryEvents.RepositoryFindOneBefore.slug)).toBeTrue();
      expect(events.has(RepositoryEvents.RepositoryFindOneAfter.slug)).toBeTrue();
      events.clear();

      await repo.findMany({ where: { id: 1 } });
      await repo.emgr.executeAsyncs();
      expect(events.has(RepositoryEvents.RepositoryFindManyBefore.slug)).toBeTrue();
      expect(events.has(RepositoryEvents.RepositoryFindManyAfter.slug)).toBeTrue();
      events.clear();

      await repo.findManyByReference(1, "categories");
      await repo.emgr.executeAsyncs();
      expect(events.has(RepositoryEvents.RepositoryFindManyBefore.slug)).toBeTrue();
      expect(events.has(RepositoryEvents.RepositoryFindManyAfter.slug)).toBeTrue();
      events.clear();
   });
});
