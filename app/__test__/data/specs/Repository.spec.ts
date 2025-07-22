import { afterAll, describe, expect, test } from "bun:test";
import type { Kysely, Transaction } from "kysely";
import { TextField } from "data/fields";
import { em as $em, entity as $entity, text as $text } from "data/prototype";
import { Entity, EntityManager } from "data/entities";
import { ManyToOneRelation } from "data/relations";
import { RepositoryEvents } from "data/events";
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
      expect(res.data.count).toBe(3);

      //
      {
         const res = await em.repository(items).findMany();
         expect(res.count).toBe(3);
      }

      {
         const res = await em
            .repository(items, {
               includeCounts: true,
            })
            .findMany();
         expect(res.count).toBe(3);
      }

      // count filtered
      const res2 = await em
         .repository(items, {
            includeCounts: true,
         })
         .count({ label: { $in: ["a", "b"] } });

      expect(res2.sql).toBe('select count(*) as "count" from "items" where "label" in (?, ?)');
      expect(res2.parameters).toEqual(["a", "b"]);
      expect(res2.data.count).toBe(2);

      // check exists
      const res3 = await em.repository(items).exists({ label: "a" });
      expect(res3.data.exists).toBe(true);

      const res4 = await em.repository(items).exists({ label: "d" });
      expect(res4.data.exists).toBe(false);

      // for now, allow empty filter
      const res5 = await em.repository(items).exists({});
      expect(res5.data.exists).toBe(true);
   });

   test("option: silent", async () => {
      const em = $em({
         items: $entity("items", {
            label: $text(),
         }),
      }).proto.withConnection(getDummyConnection().dummyConnection);

      // should throw because table doesn't exist
      expect(em.repo("items").findMany({})).rejects.toThrow(/no such table/);
      // should silently return empty result
      em.repo("items", { silent: true })
         .findMany({})
         .then((r) => r.data);
      expect(
         em
            .repo("items", { silent: true })
            .findMany({})
            .then((r) => r.data),
      ).resolves.toEqual([]);
   });

   test("option: includeCounts", async () => {
      const em = $em({
         items: $entity("items", {
            label: $text(),
         }),
      }).proto.withConnection(getDummyConnection().dummyConnection);
      await em.schema().sync({ force: true });

      expect(
         em
            .repo("items", { includeCounts: true })
            .findMany({})
            .then((r) => [r.count, r.total]),
      ).resolves.toEqual([0, 0]);

      expect(
         em
            .repo("items", { includeCounts: false })
            .findMany({})
            .then((r) => [r.count, r.total]),
      ).resolves.toEqual([undefined, undefined]);
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

      // check find one on findMany with limit 1
      await repo.findMany({ where: { id: 1 }, limit: 1 });
      await repo.emgr.executeAsyncs();
      expect(events.has(RepositoryEvents.RepositoryFindOneBefore.slug)).toBeTrue();
      expect(events.has(RepositoryEvents.RepositoryFindOneAfter.slug)).toBeTrue();
      events.clear();
   });
});
