// eslint-disable-next-line import/no-unresolved
import { afterAll, describe, expect, test } from "bun:test";
import { Entity, EntityManager } from "data/entities";
import { NumberField, TextField } from "data/fields";
import { TransformPersistFailedException } from "data/errors";
import { getDummyConnection } from "./helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterAll(afterAllCleanup);

describe("Mutator simple", async () => {
   const connection = dummyConnection;
   //const connection = getLocalLibsqlConnection();
   //const connection = getCreds("DB_DATA");

   const items = new Entity("items", [
      new TextField("label", { required: true, minLength: 1 }),
      new NumberField("count", { default_value: 0 }),
   ]);
   const em = new EntityManager<any>([items], connection);

   await em.connection.kysely.schema
      .createTable("items")
      .ifNotExists()
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement().notNull())
      .addColumn("label", "text")
      .addColumn("count", "integer")
      .execute();

   test("insert single row", async () => {
      const mutation = await em.mutator(items).insertOne({
         label: "test",
         count: 1,
      });

      expect(mutation.sql).toBe(
         'insert into "items" ("count", "label") values (?, ?) returning "id", "label", "count"',
      );
      expect(mutation.data).toEqual({ id: 1, label: "test", count: 1 });

      const query = await em.repository(items).findMany({
         limit: 1,
         sort: {
            by: "id",
            dir: "desc",
         },
      });

      expect(query.data).toEqual([{ id: 1, label: "test", count: 1 }]);
   });

   test("update inserted row", async () => {
      const query = await em.repository(items).findMany({
         limit: 1,
         sort: {
            by: "id",
            dir: "desc",
         },
      });
      const id = query.data![0].id as number;

      const mutation = await em.mutator(items).updateOne(id, {
         label: "new label",
         count: 100,
      });

      expect(mutation.sql).toBe(
         'update "items" set "label" = ?, "count" = ? where "id" = ? returning "id", "label", "count"',
      );
      expect(mutation.data).toEqual({ id, label: "new label", count: 100 });
   });

   test("delete updated row", async () => {
      const query = await em.repository(items).findMany({
         limit: 1,
         sort: {
            by: "id",
            dir: "desc",
         },
      });

      const id = query.data![0].id as number;
      const mutation = await em.mutator(items).deleteOne(id);

      expect(mutation.sql).toBe(
         'delete from "items" where "id" = ? returning "id", "label", "count"',
      );
      expect(mutation.data).toEqual({ id, label: "new label", count: 100 });

      const query2 = await em.repository(items).findId(id);
      expect(query2.data).toBeUndefined();
   });

   test("validation: insert incomplete row", async () => {
      const incompleteCreate = async () =>
         await em.mutator(items).insertOne({
            //label: "test",
            count: 1,
         });

      expect(incompleteCreate()).rejects.toThrow();
   });

   test("validation: insert invalid row", async () => {
      const invalidCreate1 = async () =>
         await em.mutator(items).insertOne({
            label: 111, // this should work
            count: "1", // this should fail
         });

      expect(invalidCreate1()).rejects.toThrow(TransformPersistFailedException);

      const invalidCreate2 = async () =>
         await em.mutator(items).insertOne({
            label: "", // this should fail
            count: 1,
         });

      expect(invalidCreate2()).rejects.toThrow(TransformPersistFailedException);
   });

   test("test default value", async () => {
      const res = await em.mutator(items).insertOne({ label: "yo" });

      expect(res.data.count).toBe(0);
   });

   test("deleteMany", async () => {
      await em.mutator(items).insertOne({ label: "keep" });
      await em.mutator(items).insertOne({ label: "delete" });
      await em.mutator(items).insertOne({ label: "delete" });

      const data = (await em.repository(items).findMany()).data;
      //console.log(data);

      await em.mutator(items).deleteWhere({ label: "delete" });

      expect((await em.repository(items).findMany()).data.length).toBe(data.length - 2);
      //console.log((await em.repository(items).findMany()).data);

      await em.mutator(items).deleteWhere({ id: { $isnull: 0 } });
      expect((await em.repository(items).findMany()).data.length).toBe(0);

      //expect(res.data.count).toBe(0);
   });

   test("updateMany", async () => {
      await em.mutator(items).insertOne({ label: "update", count: 1 });
      await em.mutator(items).insertOne({ label: "update too", count: 1 });
      await em.mutator(items).insertOne({ label: "keep" });

      // expect no update
      await em.mutator(items).updateWhere(
         { count: 2 },
         {
            count: 10,
         },
      );
      expect((await em.repository(items).findMany()).data).toEqual([
         { id: 6, label: "update", count: 1 },
         { id: 7, label: "update too", count: 1 },
         { id: 8, label: "keep", count: 0 },
      ]);

      // expect 2 to be updated
      await em.mutator(items).updateWhere(
         { count: 2 },
         {
            count: 1,
         },
      );

      expect((await em.repository(items).findMany()).data).toEqual([
         { id: 6, label: "update", count: 2 },
         { id: 7, label: "update too", count: 2 },
         { id: 8, label: "keep", count: 0 },
      ]);
   });

   test("insertMany", async () => {
      const oldCount = (await em.repo(items).count()).data.count;
      const inserts = [{ label: "insert 1" }, { label: "insert 2" }];
      const { data } = await em.mutator(items).insertMany(inserts);

      expect(data.length).toBe(2);
      expect(data.map((d) => ({ label: d.label }))).toEqual(inserts);
      const newCount = (await em.repo(items).count()).data.count;
      expect(newCount).toBe(oldCount + inserts.length);

      const { data: data2 } = await em.repo(items).findMany({ offset: oldCount });
      expect(data2).toEqual(data);
   });
});
