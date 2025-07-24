import { afterEach, describe, test, expect } from "bun:test";
import { App, createApp } from "core/test/utils";
import { getDummyConnection } from "./helper";
import { Hono } from "hono";
import * as proto from "../src/data/prototype";
import { pick } from "lodash-es";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterEach(afterAllCleanup);

describe("App tests", async () => {
   test("boots and pongs", async () => {
      const app = new App(dummyConnection);
      await app.build();

      expect(await app.em.ping()).toBeTrue();
   });

   test("plugins", async () => {
      const called: string[] = [];
      const app = createApp({
         initialConfig: {
            auth: {
               enabled: true,
            },
         },
         options: {
            plugins: [
               (app) => {
                  expect(app).toBeDefined();
                  expect(app).toBeInstanceOf(App);
                  return {
                     name: "test",
                     schema: () => {
                        called.push("schema");
                        return proto.em(
                           {
                              posts: proto.entity("posts", {
                                 title: proto.text(),
                              }),
                              comments: proto.entity("comments", {
                                 content: proto.text(),
                              }),
                              users: proto.entity("users", {
                                 email_verified: proto.boolean(),
                              }),
                           },
                           (fn, s) => {
                              fn.relation(s.comments).manyToOne(s.posts);
                              fn.index(s.posts).on(["title"]);
                           },
                        );
                     },
                     onBoot: async () => {
                        called.push("onBoot");
                     },
                     beforeBuild: async () => {
                        called.push("beforeBuild");
                     },
                     onBuilt: async () => {
                        called.push("onBuilt");
                     },
                     onServerInit: async (server) => {
                        called.push("onServerInit");
                        expect(server).toBeDefined();
                        expect(server).toBeInstanceOf(Hono);
                     },
                     onFirstBoot: async () => {
                        called.push("onFirstBoot");
                     },
                  };
               },
            ],
         },
      });

      await app.build();

      expect(app.em.entities.map((e) => e.name)).toEqual(["users", "posts", "comments"]);
      expect(app.em.indices.map((i) => i.name)).toEqual([
         "idx_unique_users_email",
         "idx_users_strategy",
         "idx_users_strategy_value",
         "idx_posts_title",
      ]);
      expect(
         app.em.relations.all.map((r) => pick(r.toJSON(), ["type", "source", "target"])),
      ).toEqual([
         {
            type: "n:1",
            source: "comments",
            target: "posts",
         },
      ]);
      expect(called).toEqual([
         "onBoot",
         "onServerInit",
         "beforeBuild",
         "onServerInit",
         "schema",
         "onFirstBoot",
         "onBuilt",
      ]);
      expect(app.plugins.size).toBe(1);
      expect(Array.from(app.plugins.keys())).toEqual(["test"]);
   });

   test.only("drivers", async () => {
      const called: string[] = [];
      const app = new App(dummyConnection, undefined, {
         drivers: {
            email: {
               send: async (to, subject, body) => {
                  called.push("email.send");
                  return {
                     id: "",
                  };
               },
            },
            cache: {
               get: async (key) => {
                  called.push("cache.get");
                  return "";
               },
               set: async (key, value, ttl) => {
                  called.push("cache.set");
               },
               del: async (key) => {
                  called.push("cache.del");
               },
            },
         },
      });
      await app.build();

      expect(app.drivers.cache).toBeDefined();
      expect(app.drivers.email).toBeDefined();
      await app.drivers.email.send("", "", "");
      await app.drivers.cache.get("");
      await app.drivers.cache.set("", "", 0);
      await app.drivers.cache.del("");

      expect(called).toEqual(["email.send", "cache.get", "cache.set", "cache.del"]);
   });
});
