import { describe, expect, test } from "bun:test";
import { stripMark } from "../../src/core/utils";
import { type TSchema, Type } from "@sinclair/typebox";
import { EntityManager, em, entity, index, text } from "../../src/data";
import { DummyConnection } from "../../src/data/connection/DummyConnection";
import { Module } from "../../src/modules/Module";

function createModule<Schema extends TSchema>(schema: Schema) {
   class TestModule extends Module<typeof schema> {
      getSchema() {
         return schema;
      }
      override toJSON() {
         return this.config;
      }
      override useForceParse() {
         return true;
      }
   }

   return TestModule;
}

describe("Module", async () => {
   describe("basic", () => {
      test("listener", async () => {
         let result: any;

         const module = createModule(Type.Object({ a: Type.String() }));
         const m = new module({ a: "test" });

         await m.schema().set({ a: "test2" });
         m.setListener(async (c) => {
            await new Promise((r) => setTimeout(r, 10));
            result = stripMark(c);
         });
         await m.schema().set({ a: "test3" });
         expect(result).toEqual({ a: "test3" });
      });
   });

   describe("db schema", () => {
      class M extends Module {
         override getSchema() {
            return Type.Object({});
         }

         prt = {
            ensureEntity: this.ensureEntity.bind(this),
            ensureIndex: this.ensureIndex.bind(this),
            ensureSchema: this.ensureSchema.bind(this),
         };

         get em() {
            return this.ctx.em;
         }
      }

      function make(_em: ReturnType<typeof em>) {
         const em = new EntityManager(
            Object.values(_em.entities),
            new DummyConnection(),
            _em.relations,
            _em.indices,
         );
         return new M({} as any, { em, flags: Module.ctx_flags } as any);
      }
      function flat(_em: EntityManager) {
         return {
            entities: _em.entities.map((e) => ({
               name: e.name,
               fields: e.fields.map((f) => f.name),
               type: e.type,
            })),
            indices: _em.indices.map((i) => ({
               name: i.name,
               entity: i.entity.name,
               fields: i.fields.map((f) => f.name),
               unique: i.unique,
            })),
         };
      }

      test("no change", () => {
         const initial = em({});

         const m = make(initial);
         expect(m.ctx.flags.sync_required).toBe(false);

         expect(flat(make(initial).em)).toEqual({
            entities: [],
            indices: [],
         });
      });

      test("init", () => {
         const initial = em({
            users: entity("u", {
               name: text(),
            }),
         });

         const m = make(initial);
         expect(m.ctx.flags.sync_required).toBe(false);

         expect(flat(m.em)).toEqual({
            entities: [
               {
                  name: "u",
                  fields: ["id", "name"],
                  type: "regular",
               },
            ],
            indices: [],
         });
      });

      test("ensure entity", () => {
         const initial = em({
            users: entity("u", {
               name: text(),
            }),
         });

         const m = make(initial);
         expect(flat(m.em)).toEqual({
            entities: [
               {
                  name: "u",
                  fields: ["id", "name"],
                  type: "regular",
               },
            ],
            indices: [],
         });

         // this should add a new entity
         m.prt.ensureEntity(
            entity("p", {
               title: text(),
            }),
         );

         // this should only add the field "important"
         m.prt.ensureEntity(
            entity(
               "u",
               {
                  important: text(),
               },
               undefined,
               "system",
            ),
         );

         expect(m.ctx.flags.sync_required).toBe(true);
         expect(flat(m.em)).toEqual({
            entities: [
               {
                  name: "u",
                  fields: ["id", "name", "important"],
                  // ensured type must be present
                  type: "system",
               },
               {
                  name: "p",
                  fields: ["id", "title"],
                  type: "regular",
               },
            ],
            indices: [],
         });
      });

      test("ensure index", () => {
         const users = entity("u", {
            name: text(),
            title: text(),
         });
         const initial = em({ users }, ({ index }, { users }) => {
            index(users).on(["title"]);
         });

         const m = make(initial);
         m.prt.ensureIndex(index(users).on(["name"]));

         expect(m.ctx.flags.sync_required).toBe(true);
         expect(flat(m.em)).toEqual({
            entities: [
               {
                  name: "u",
                  fields: ["id", "name", "title"],
                  type: "regular",
               },
            ],
            indices: [
               {
                  name: "idx_u_title",
                  entity: "u",
                  fields: ["title"],
                  unique: false,
               },
               {
                  name: "idx_u_name",
                  entity: "u",
                  fields: ["name"],
                  unique: false,
               },
            ],
         });
      });
   });
});
