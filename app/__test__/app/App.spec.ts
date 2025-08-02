import { describe, expect, mock, test } from "bun:test";
import type { ModuleBuildContext } from "../../src";
import { App, createApp } from "core/test/utils";
import * as proto from "../../src/data/prototype";

describe("App", () => {
   test("seed includes ctx and app", async () => {
      const called = mock(() => null);
      await createApp({
         options: {
            seed: async ({ app, ...ctx }) => {
               called();
               expect(app).toBeDefined();
               expect(ctx).toBeDefined();
               expect(Object.keys(ctx)).toEqual([
                  "connection",
                  "server",
                  "em",
                  "emgr",
                  "guard",
                  "flags",
                  "logger",
                  "mcp",
                  "helper",
               ]);
            },
         },
      }).build();
      expect(called).toHaveBeenCalled();

      const app = createApp({
         initialConfig: {
            data: proto
               .em({
                  todos: proto.entity("todos", {
                     title: proto.text(),
                  }),
               })
               .toJSON(),
         },
         options: {
            //manager: { verbosity: 2 },
            seed: async ({ app, ...ctx }: ModuleBuildContext & { app: App }) => {
               await ctx.em.mutator("todos").insertOne({ title: "ctx" });
               await app.getApi().data.createOne("todos", { title: "api" });
            },
         },
      });
      await app.build();

      const todos = await app.getApi().data.readMany("todos");
      expect(todos.length).toBe(2);
      expect(todos[0]?.title).toBe("ctx");
      expect(todos[1]?.title).toBe("api");
   });

   test("lifecycle events are triggered", async () => {
      const firstBoot = mock(() => null);
      const configUpdate = mock(() => null);
      const appBuilt = mock(() => null);
      const appRequest = mock(() => null);
      const beforeResponse = mock(() => null);

      const app = createApp();

      app.emgr.onEvent(
         App.Events.AppFirstBoot,
         (event) => {
            expect(event).toBeInstanceOf(App.Events.AppFirstBoot);
            expect(event.params.app.version()).toBe(app.version());
            firstBoot();
         },
         "sync",
      );
      app.emgr.onEvent(
         App.Events.AppBuiltEvent,
         (event) => {
            expect(event).toBeInstanceOf(App.Events.AppBuiltEvent);
            expect(event.params.app.version()).toBe(app.version());
            appBuilt();
         },
         "sync",
      );
      app.emgr.onEvent(
         App.Events.AppConfigUpdatedEvent,
         () => {
            configUpdate();
         },
         "sync",
      );
      app.emgr.onEvent(
         App.Events.AppRequest,
         (event) => {
            expect(event).toBeInstanceOf(App.Events.AppRequest);
            expect(event.params.app.version()).toBe(app.version());
            expect(event.params.request).toBeInstanceOf(Request);
            appRequest();
         },
         "sync",
      );
      app.emgr.onEvent(
         App.Events.AppBeforeResponse,
         (event) => {
            expect(event).toBeInstanceOf(App.Events.AppBeforeResponse);
            expect(event.params.app.version()).toBe(app.version());
            expect(event.params.response).toBeInstanceOf(Response);
            beforeResponse();
         },
         "sync",
      );

      await app.build();
      expect(firstBoot).toHaveBeenCalled();
      expect(appBuilt).toHaveBeenCalled();
      //expect(configUpdate).toHaveBeenCalled();
      expect(appRequest).not.toHaveBeenCalled();
      expect(beforeResponse).not.toHaveBeenCalled();
   });

   test("emgr exec modes", async () => {
      const called = mock(() => null);
      const app = createApp({
         options: {
            asyncEventsMode: "sync",
         },
      });

      // register async listener
      app.emgr.onEvent(App.Events.AppFirstBoot, async () => {
         called();
      });

      await app.build();
      await app.server.request(new Request("http://localhost"));

      // expect async listeners to be executed sync after request
      expect(called).toHaveBeenCalled();
   });
});
