import { beforeEach, describe, expect, it } from "bun:test";

import { Hono } from "hono";
import { Guard } from "auth/authorize/Guard";
import { DebugLogger } from "core/utils/DebugLogger";
import { EventManager } from "core/events";
import { EntityManager } from "data/entities/EntityManager";
import { Module, type ModuleBuildContext } from "modules/Module";
import { getDummyConnection } from "../helper";
import { ModuleHelper } from "modules/ModuleHelper";
import { McpServer } from "bknd/utils";

export function makeCtx(overrides?: Partial<ModuleBuildContext>): ModuleBuildContext {
   const { dummyConnection } = getDummyConnection();
   const ctx = {
      connection: dummyConnection,
      server: new Hono(),
      em: new EntityManager([], dummyConnection),
      emgr: new EventManager(),
      guard: new Guard(),
      flags: Module.ctx_flags,
      logger: new DebugLogger(false),
      mcp: new McpServer(),
      ...overrides,
   };
   return {
      ...ctx,
      helper: new ModuleHelper(ctx as any),
   } as any;
}

export function moduleTestSuite(module: { new (): Module }) {
   let ctx: ModuleBuildContext;

   beforeEach(() => {
      ctx = makeCtx();
   });

   describe("Module Tests", () => {
      it("should build without exceptions", async () => {
         const m = new module();
         await m.setContext(ctx).build();
         expect(m.toJSON()).toBeDefined();
      });

      it("uses the default config", async () => {
         const m = new module();
         await m.setContext(ctx).build();
         expect(m.toJSON()).toEqual(m.getSchema().template({}, { withOptional: true }));
         //expect(stripMark(m.toJSON())).toEqual(Default(m.getSchema(), {}));
      });
   });
}
