import { describe, expect, test } from "bun:test";
import { Registry } from "core/registry/Registry";
import { s } from "core/utils/schema";

type Constructor<T> = new (...args: any[]) => T;

type ClassRef<T> = Constructor<T> & (new (...args: any[]) => T);

class What {
   method() {
      return null;
   }
   getType() {
      return s.object({ type: s.string() });
   }
}
class What2 extends What {}
class NotAllowed {}

type Test1 = {
   cls: new (...args: any[]) => What;
   schema: s.ObjectSchema<{ type: s.StringSchema }>;
   enabled: boolean;
};

describe("Registry", () => {
   test("adds an item", async () => {
      const registry = new Registry<Test1>().set({
         first: {
            cls: What,
            schema: s.object({ type: s.string(), what: s.string() }),
            enabled: true,
         },
      } satisfies Record<string, Test1>);

      const item = registry.get("first");
      expect(item).toBeDefined();
      expect(item?.cls).toBe(What);

      const second = s.object({ type: s.string(), what: s.string() });
      registry.add("second", {
         cls: What2,
         schema: second,
         enabled: true,
      });
      // @ts-ignore
      expect(registry.get("second").schema).toEqual(second);

      const third = s.object({ type: s.string({ default: "1" }), what22: s.string() });
      registry.add("third", {
         // @ts-expect-error
         cls: NotAllowed,
         schema: third,
         enabled: true,
      });
      // @ts-ignore
      expect(registry.get("third").schema).toEqual(third);

      const fourth = s.object({ type: s.number(), what22: s.string() });
      registry.add("fourth", {
         cls: What,
         // @ts-expect-error
         schema: fourth,
         enabled: true,
      });
      // @ts-ignore
      expect(registry.get("fourth").schema).toEqual(fourth);

      expect(Object.keys(registry.all()).length).toBe(4);
   });

   test("uses registration fn", async () => {
      const registry = new Registry<Test1>((a: ClassRef<What>) => {
         return {
            cls: a,
            schema: a.prototype.getType(),
            enabled: true,
         };
      });

      registry.register("what2", What2);
      expect(registry.get("what2")).toBeDefined();
      expect(registry.get("what2").cls).toBe(What2);
      expect(JSON.stringify(registry.get("what2").schema)).toEqual(
         JSON.stringify(What2.prototype.getType()),
      );
   });
});
