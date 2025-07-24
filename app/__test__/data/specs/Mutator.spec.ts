import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { EventManager } from "../../../src/core/events";
import {
   Entity,
   EntityManager,
   ManyToOneRelation,
   MutatorEvents,
   NumberField,
   OneToOneRelation,
   type RelationField,
   RelationMutator,
   TextField,
} from "../../../src/data";
import * as proto from "../../../src/data/prototype";
import { getDummyConnection, disableConsoleLog, enableConsoleLog } from "../../helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterAll(afterAllCleanup);

beforeAll(() => disableConsoleLog(["log", "warn"]));
afterAll(async () => (await afterAllCleanup()) && enableConsoleLog());

describe("[data] Mutator (base)", async () => {
   const entity = new Entity("items", [
      new TextField("label", { required: true }),
      new NumberField("count"),
      new TextField("hidden", { hidden: true }),
      new TextField("not_fillable", { fillable: false }),
   ]);
   const em = new EntityManager<any>([entity], dummyConnection);
   await em.schema().sync({ force: true });

   const payload = { label: "item 1", count: 1 };

   test("insertOne", async () => {
      expect(em.mutator(entity).getValidatedData(payload, "create")).resolves.toEqual(payload);
      const res = await em.mutator(entity).insertOne(payload);

      // checking params, because we can't know the id
      // if it wouldn't be successful, it would throw an error
      expect(res.parameters).toEqual(Object.values(payload));

      // but expect additional fields to be present
      expect((res.data as any).not_fillable).toBeDefined();
   });

   test("updateOne", async () => {
      const { data } = await em.mutator(entity).insertOne(payload);
      const updated = await em.mutator(entity).updateOne(data.id, {
         count: 2,
      });

      expect(updated.parameters).toEqual([2, data.id]);
      expect(updated.data.count).toBe(2);
   });

   test("deleteOne", async () => {
      const { data } = await em.mutator(entity).insertOne(payload);
      const deleted = await em.mutator(entity).deleteOne(data.id);

      expect(deleted.parameters).toEqual([data.id]);
   });
});

describe("[data] Mutator (ManyToOne)", async () => {
   const posts = new Entity("posts", [new TextField("title")]);
   const users = new Entity("users", [new TextField("username")]);
   const relations = [new ManyToOneRelation(posts, users)];
   const em = new EntityManager<any>([posts, users], dummyConnection, relations);
   await em.schema().sync({ force: true });

   test("RelationMutator", async () => {
      // create entries
      const userData = await em.mutator(users).insertOne({ username: "user1" });
      const postData = await em.mutator(posts).insertOne({ title: "post1" });

      const postRelMutator = new RelationMutator(posts, em);
      const postRelField = posts.getField("users_id")! as RelationField;
      expect(postRelMutator.getRelationalKeys()).toEqual(["users", "users_id"]);

      // persisting relational field should just return key value to be added
      expect(
         postRelMutator.persistRelationField(postRelField, "users_id", userData.data.id),
      ).resolves.toEqual(["users_id", userData.data.id]);

      // persisting invalid value should throw
      expect(postRelMutator.persistRelationField(postRelField, "users_id", 0)).rejects.toThrow();

      // persisting reference should ...
      expect(
         postRelMutator.persistReference(relations[0]!, "users", {
            $set: { id: userData.data.id },
         }),
      ).resolves.toEqual(["users_id", userData.data.id]);
      // @todo: add what methods are allowed to relation, like $create should not be allowed for post<>users

      const userRelMutator = new RelationMutator(users, em);
      expect(userRelMutator.getRelationalKeys()).toEqual(["posts"]);
   });

   test("insertOne: missing ref", async () => {
      expect(
         em.mutator(posts).insertOne({
            title: "post1",
            users_id: 100, // user does not exist yet
         }),
      ).rejects.toThrow();
   });

   test("insertOne: missing required relation", async () => {
      const items = new Entity("items", [new TextField("label")]);
      const cats = new Entity("cats");
      const relations = [new ManyToOneRelation(items, cats, { required: true })];
      const em = new EntityManager([items, cats], dummyConnection, relations);

      expect(em.mutator(items).insertOne({ label: "test" })).rejects.toThrow(
         'Field "cats_id" is required',
      );
   });

   test("insertOne: using field name", async () => {
      const { data } = await em.mutator(users).insertOne({ username: "user1" });
      const res = await em.mutator(posts).insertOne({
         title: "post1",
         users_id: data.id,
      });
      expect(res.data.users_id).toBe(data.id);

      // setting "null" should be allowed
      const res2 = await em.mutator(posts).insertOne({
         title: "post1",
         users_id: null,
      });
      expect(res2.data.users_id).toBe(null);
   });

   test("insertOne: using reference", async () => {
      const { data } = await em.mutator(users).insertOne({ username: "user1" });
      const res = await em.mutator(posts).insertOne({
         title: "post1",
         users: { $set: { id: data.id } },
      });
      expect(res.data.users_id).toBe(data.id);

      // setting "null" should be allowed
      const res2 = await em.mutator(posts).insertOne({
         title: "post1",
         users: { $set: { id: null } },
      });
      expect(res2.data.users_id).toBe(null);
   });

   test("insertOne: performing unsupported operations", async () => {
      expect(
         em.mutator(posts).insertOne({
            title: "test",
            users: { $create: { username: "test" } },
         }),
      ).rejects.toThrow();
   });

   test("updateOne", async () => {
      const res1 = await em.mutator(users).insertOne({ username: "user1" });
      const res1_1 = await em.mutator(users).insertOne({ username: "user1" });
      const res2 = await em.mutator(posts).insertOne({ title: "post1" });

      const up1 = await em.mutator(posts).updateOne(res2.data.id, {
         users: { $set: { id: res1.data.id } },
      });
      expect(up1.data.users_id).toBe(res1.data.id);

      const up2 = await em.mutator(posts).updateOne(res2.data.id, {
         users: { $set: { id: res1_1.data.id } },
      });
      expect(up2.data.users_id).toBe(res1_1.data.id);

      const up3_1 = await em.mutator(posts).updateOne(res2.data.id, {
         users_id: res1.data.id,
      });
      expect(up3_1.data.users_id).toBe(res1.data.id);

      const up3_2 = await em.mutator(posts).updateOne(res2.data.id, {
         users_id: res1_1.data.id,
      });
      expect(up3_2.data.users_id).toBe(res1_1.data.id);

      const up4 = await em.mutator(posts).updateOne(res2.data.id, {
         users_id: null,
      });
      expect(up4.data.users_id).toBe(null);
   });
});

describe("[data] Mutator (OneToOne)", async () => {
   const users = new Entity("users", [new TextField("username")]);
   const settings = new Entity("settings", [new TextField("theme")]);
   const relations = [new OneToOneRelation(users, settings)];
   const em = new EntityManager<any>([users, settings], dummyConnection, relations);
   await em.schema().sync({ force: true });

   test("insertOne: missing ref", async () => {
      expect(
         em.mutator(users).insertOne({
            username: "test",
            settings_id: 1, // todo: throws because it doesn't exist, but it shouldn't be allowed
         }),
      ).rejects.toThrow();
   });

   test("insertOne: using reference", async () => {
      // $set is not allowed in OneToOne
      const { data } = await em.mutator(settings).insertOne({ theme: "dark" });
      expect(
         em.mutator(users).insertOne({
            username: "test",
            settings: { $set: { id: data.id } },
         }),
      ).rejects.toThrow();
   });

   test("insertOne: using $create", async () => {
      const res = await em.mutator(users).insertOne({
         username: "test",
         settings: { $create: { theme: "dark" } },
      });
      expect(res.data.settings_id).toBeDefined();
   });
});
/*
describe("[data] Mutator (ManyToMany)", async () => {
   const posts = new Entity("posts", [new TextField("title")]);
   const tags = new Entity("tags", [new TextField("name")]);
   const relations = [new ManyToOneRelation(posts, tags)];
   const em = new EntityManager([posts, tags], dummyConnection, relations);
   await em.schema().sync({ force: true });

   test("insertOne: missing ref", async () => {
      expect(
         em.mutator(posts).insertOne({
            title: "post1",
            tags_id: 1, // tag does not exist yet
         }),
      ).rejects.toThrow();
   });

   test("insertOne: using reference", async () => {
      const { data } = await em.mutator(tags).insertOne({ name: "tag1" });
      const res = await em.mutator(posts).insertOne({
         title: "post1",
         tags: { $attach: { id: data.id } },
      });
      expect(res.data.tags).toContain(data.id);
   });

   test("insertOne: using $create", async () => {
      const res = await em.mutator(posts).insertOne({
         title: "post1",
         tags: { $create: { name: "tag1" } },
      });
      expect(res.data.tags).toBeDefined();
   });

   test("insertOne: using $detach", async () => {
      const { data: tagData } = await em.mutator(tags).insertOne({ name: "tag1" });
      const { data: postData } = await em.mutator(posts).insertOne({ title: "post1" });

      const res = await em.mutator(posts).insertOne({
         title: "post1",
         tags: { $attach: { id: tagData.id } },
      });
      expect(res.data.tags).toContain(tagData.id);

      const res2 = await em.mutator(posts).updateOne(postData.id, {
         tags: { $detach: { id: tagData.id } },
      });
      expect(res2.data.tags).not.toContain(tagData.id);
   });
});*/

describe("[data] Mutator (Events)", async () => {
   const entity = new Entity("test", [new TextField("label")]);
   const em = new EntityManager<any>([entity], dummyConnection);
   await em.schema().sync({ force: true });
   const events = new Map<string, any>();

   const mutator = em.mutator(entity);
   mutator.emgr.onAny((event) => {
      // @ts-ignore
      events.set(event.constructor.slug, event);
   });

   test("events were fired", async () => {
      const { data } = await mutator.insertOne({ label: "test" });
      await mutator.emgr.executeAsyncs();
      expect(events.has(MutatorEvents.MutatorInsertBefore.slug)).toBeTrue();
      expect(events.has(MutatorEvents.MutatorInsertAfter.slug)).toBeTrue();

      await mutator.updateOne(data.id, { label: "test2" });
      await mutator.emgr.executeAsyncs();
      expect(events.has(MutatorEvents.MutatorUpdateBefore.slug)).toBeTrue();
      expect(events.has(MutatorEvents.MutatorUpdateAfter.slug)).toBeTrue();

      await mutator.deleteOne(data.id);
      await mutator.emgr.executeAsyncs();
      expect(events.has(MutatorEvents.MutatorDeleteBefore.slug)).toBeTrue();
      expect(events.has(MutatorEvents.MutatorDeleteAfter.slug)).toBeTrue();
   });

   test("insertOne event return is respected", async () => {
      const posts = proto.entity("posts", {
         title: proto.text(),
         views: proto.number(),
      });

      const conn = getDummyConnection();
      const em = new EntityManager([posts], conn.dummyConnection);
      await em.schema().sync({ force: true });

      const emgr = em.emgr as EventManager<any>;

      emgr.onEvent(
         // @ts-ignore
         EntityManager.Events.MutatorInsertBefore,
         async (event) => {
            return {
               ...event.params.data,
               views: 2,
            };
         },
         "sync",
      );

      const mutator = em.mutator("posts");
      const result = await mutator.insertOne({ title: "test", views: 1 });
      expect(result.data).toEqual({
         id: 1,
         title: "test",
         views: 2,
      });
   });

   test("updateOne event return is respected", async () => {
      const posts = proto.entity("posts", {
         title: proto.text(),
         views: proto.number(),
      });

      const conn = getDummyConnection();
      const em = new EntityManager([posts], conn.dummyConnection);
      await em.schema().sync({ force: true });

      const emgr = em.emgr as EventManager<any>;

      emgr.onEvent(
         // @ts-ignore
         EntityManager.Events.MutatorUpdateBefore,
         async (event) => {
            return {
               ...event.params.data,
               views: event.params.data.views + 1,
            };
         },
         "sync",
      );

      const mutator = em.mutator("posts");
      const created = await mutator.insertOne({ title: "test", views: 1 });
      const result = await mutator.updateOne(created.data.id, { views: 2 });
      expect(result.data).toEqual({
         id: 1,
         title: "test",
         views: 3,
      });
   });
});
