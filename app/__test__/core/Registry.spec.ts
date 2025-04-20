import { describe, expect, test } from "bun:test";
import { type TObject, type TString, Type } from "@sinclair/typebox";
import { Registry } from "core";

type Constructor<T> = new (...args: any[]) => T;

type ClassRef<T> = Constructor<T> & (new (...args: any[]) => T);

class What {
   method() {
      return null;
   }
   getType() {
      return Type.Object({ type: Type.String() });
   }
}
class What2 extends What {}
class NotAllowed {}

type Test1 = {
   cls: new (...args: any[]) => What;
   schema: TObject<{ type: TString }>;
   enabled: boolean;
};

describe("Registry", () => {
   test("adds an item", async () => {
      const registry = new Registry<Test1>().set({
         first: {
            cls: What,
            schema: Type.Object({ type: Type.String(), what: Type.String() }),
            enabled: true,
         },
      } satisfies Record<string, Test1>);

      const item = registry.get("first");
      expect(item).toBeDefined();
      expect(item?.cls).toBe(What);

      const second = Type.Object({ type: Type.String(), what: Type.String() });
      registry.add("second", {
         cls: What2,
         schema: second,
         enabled: true,
      });
      // @ts-ignore
      expect(registry.get("second").schema).toEqual(second);

      const third = Type.Object({ type: Type.String({ default: "1" }), what22: Type.String() });
      registry.add("third", {
         // @ts-expect-error
         cls: NotAllowed,
         schema: third,
         enabled: true,
      });
      // @ts-ignore
      expect(registry.get("third").schema).toEqual(third);

      const fourth = Type.Object({ type: Type.Number(), what22: Type.String() });
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
      expect(registry.get("what2").schema).toEqual(What2.prototype.getType());
   });
});
