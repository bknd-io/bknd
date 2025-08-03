import { describe, expect, test } from "bun:test";
import { s } from "core/utils/schema";
import { SchemaObject } from "core/object/SchemaObject";

describe("SchemaObject", async () => {
   test("basic", async () => {
      const m = new SchemaObject(
         s.strictObject({ a: s.string({ default: "b" }) }),
         { a: "test" },
         {
            forceParse: true,
         },
      );

      expect(m.get()).toEqual({ a: "test" });
      expect(m.default()).toEqual({ a: "b" });

      // direct modification is not allowed
      expect(() => {
         m.get().a = "test2";
      }).toThrow();
   });

   test("patch", async () => {
      const m = new SchemaObject(
         s.strictObject({
            s: s.strictObject(
               {
                  a: s.string({ default: "b" }),
                  b: s.strictObject(
                     {
                        c: s.string({ default: "d" }),
                        e: s.string({ default: "f" }),
                     },
                     { default: {} },
                  ),
               },
               { default: {} },
            ),
         }),
      );
      expect(m.get()).toEqual({ s: { a: "b", b: { c: "d", e: "f" } } });

      await m.patch("s.a", "c");

      // non-existing path on no additional properties
      expect(m.patch("s.s.s", "c")).rejects.toThrow();
      // wrong type
      expect(() => m.patch("s.a", 1)).toThrow();

      // should have only the valid change applied
      expect(m.get().s.b.c).toBe("d");
      expect(m.get()).toEqual({ s: { a: "c", b: { c: "d", e: "f" } } });

      await m.patch("s.b.c", "d2");
      expect(m.get()).toEqual({ s: { a: "c", b: { c: "d2", e: "f" } } });
   });

   test("patch array", async () => {
      const m = new SchemaObject(
         s.strictObject({
            methods: s.array(s.string(), { default: ["GET", "PATCH"] }),
         }),
      );
      expect(m.get()).toEqual({ methods: ["GET", "PATCH"] });

      // array values are fully overwritten, whether accessed by index ...
      await m.patch("methods[0]", "POST");
      expect(m.get().methods[0]).toEqual("POST");

      // or by path!
      await m.patch("methods", ["GET", "DELETE"]);
      expect(m.get()).toEqual({ methods: ["GET", "DELETE"] });
   });

   test("remove", async () => {
      const m = new SchemaObject(
         s.object({
            s: s.object(
               {
                  a: s.string({ default: "b" }),
                  b: s.object(
                     {
                        c: s.string({ default: "d" }),
                     },
                     { default: {} },
                  ),
               },
               { default: {} },
            ),
         }),
      );
      expect(m.get()).toEqual({ s: { a: "b", b: { c: "d" } } });

      // expect no change, because the default then applies
      await m.remove("s.a");
      expect(m.get()).toEqual({ s: { a: "b", b: { c: "d" } } });

      // adding another path, and then deleting it
      await m.patch("s.c", "d");
      expect(m.get()).toEqual({ s: { a: "b", b: { c: "d" }, c: "d" } } as any);

      // now it should be removed without applying again
      await m.remove("s.c");
      expect(m.get()).toEqual({ s: { a: "b", b: { c: "d" } } });
   });

   test("set", async () => {
      const m = new SchemaObject(
         s.strictObject({
            methods: s.array(s.string(), { default: ["GET", "PATCH"] }),
         }),
      );
      expect(m.get()).toEqual({ methods: ["GET", "PATCH"] });

      await m.set({ methods: ["GET", "POST"] });
      expect(m.get()).toEqual({ methods: ["GET", "POST"] });

      // wrong type
      expect(() => m.set({ methods: [1] as any })).toThrow();
   });

   test("listener: onUpdate", async () => {
      let called = false;
      let result: any;
      const m = new SchemaObject(
         s.strictObject({
            methods: s.array(s.string(), { default: ["GET", "PATCH"] }),
         }),
         undefined,
         {
            onUpdate: async (config) => {
               await new Promise((r) => setTimeout(r, 10));
               called = true;
               result = config;
            },
         },
      );

      await m.set({ methods: ["GET", "POST"] });
      expect(called).toBe(true);
      expect(result).toEqual({ methods: ["GET", "POST"] });
   });

   test("listener: onBeforeUpdate", async () => {
      let called = false;
      const m = new SchemaObject(
         s.strictObject({
            methods: s.array(s.string(), { default: ["GET", "PATCH"] }),
         }),
         undefined,
         {
            onBeforeUpdate: async (from, to) => {
               await new Promise((r) => setTimeout(r, 10));
               called = true;
               to.methods.push("OPTIONS");
               return to;
            },
         },
      );

      const result = await m.set({ methods: ["GET", "POST"] });
      expect(called).toBe(true);
      expect(result).toEqual({ methods: ["GET", "POST", "OPTIONS"] });
      const [, result2] = await m.patch("methods", ["GET", "POST"]);
      expect(result2).toEqual({ methods: ["GET", "POST", "OPTIONS"] });
   });

   test("throwIfRestricted", async () => {
      const m = new SchemaObject(s.strictObject({}), undefined, {
         restrictPaths: ["a.b"],
      });

      expect(() => m.throwIfRestricted("a.b")).toThrow();
      expect(m.throwIfRestricted("a.c")).toBeUndefined();
      expect(() => m.throwIfRestricted({ a: { b: "c" } })).toThrow();
      expect(m.throwIfRestricted({ a: { c: "d" } })).toBeUndefined();
   });

   test("restriction bypass", async () => {
      const m = new SchemaObject(
         s.strictObject({
            s: s.strictObject(
               {
                  a: s.string({ default: "b" }),
                  b: s.strictObject(
                     {
                        c: s.string({ default: "d" }),
                     },
                     { default: {} },
                  ),
               },
               { default: {} },
            ),
         }),
         undefined,
         {
            restrictPaths: ["s.b"],
         },
      );

      expect(m.patch("s.b.c", "e")).rejects.toThrow();
      expect(m.bypass().patch("s.b.c", "e")).resolves.toBeDefined();
      expect(m.patch("s.b.c", "f")).rejects.toThrow();
      expect(m.get()).toEqual({ s: { a: "b", b: { c: "e" } } });
   });

   const dataEntitiesSchema = s.strictObject({
      entities: s.record(
         s.object({
            fields: s.record(
               s.object({
                  type: s.string(),
                  config: s.object({}).optional(),
               }),
            ),
            config: s.record(s.string()).optional(),
         }),
      ),
   });

   /* const dataEntitiesSchema = Type.Object(
      {
         entities: Type.Object(
            {},
            {
               additionalProperties: Type.Object({
                  fields: Type.Object(
                     {},
                     {
                        additionalProperties: Type.Object({
                           type: Type.String(),
                           config: Type.Optional(
                              Type.Object({}, { additionalProperties: Type.String() }),
                           ),
                        }),
                     },
                  ),
                  config: Type.Optional(Type.Object({}, { additionalProperties: Type.String() })),
               }),
            },
         ),
      },
      {
         additionalProperties: false,
      },
   ); */
   test("patch safe object, overwrite", async () => {
      const data = {
         entities: {
            some: {
               fields: {
                  a: { type: "string", config: { some: "thing" } },
               },
            },
         },
      };
      const m = new SchemaObject(dataEntitiesSchema, data, {
         forceParse: true,
         overwritePaths: [/^entities\..*\.fields\..*\.config/],
      });

      await m.patch("entities.some.fields.a", { type: "string", config: { another: "one" } });

      expect(m.get()).toEqual({
         entities: {
            some: {
               fields: {
                  a: { type: "string", config: { another: "one" } },
               },
            },
         },
      });
   });

   test("patch safe object, overwrite 2", async () => {
      const data = {
         entities: {
            users: {
               fields: {
                  email: { type: "string" },
                  password: { type: "string" },
               },
            },
         },
      };
      const m = new SchemaObject(dataEntitiesSchema, data, {
         forceParse: true,
         overwritePaths: [/^entities\..*\.fields\..*\.config\.html_config$/],
      });

      await m.patch("entities.test", {
         fields: {
            content: {
               type: "text",
            },
         },
      });

      expect(m.get()).toEqual({
         entities: {
            users: {
               fields: {
                  email: { type: "string" },
                  password: { type: "string" },
               },
            },
            test: {
               fields: {
                  content: {
                     type: "text",
                  },
               },
            },
         },
      });
   });

   test("patch safe object, overwrite 3", async () => {
      const data = {
         entities: {
            users: {
               fields: {
                  email: { type: "string" },
                  password: { type: "string" },
               },
            },
         },
      };
      const m = new SchemaObject(dataEntitiesSchema, data, {
         forceParse: true,
         overwritePaths: [/^entities\..*\.fields\..*\.config\.html_config$/],
      });

      expect(m.patch("desc", "entities.users.config.sort_dir")).rejects.toThrow();

      await m.patch("entities.test", {
         fields: {
            content: {
               type: "text",
            },
         },
      });

      await m.patch("entities.users.config", {
         sort_dir: "desc",
      });

      expect(m.get()).toEqual({
         entities: {
            users: {
               fields: {
                  email: { type: "string" },
                  password: { type: "string" },
               },
               config: {
                  sort_dir: "desc",
               },
            },
            test: {
               fields: {
                  content: {
                     type: "text",
                  },
               },
            },
         },
      });
   });
});
