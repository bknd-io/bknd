import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { Event, EventManager, InvalidEventReturn, NoParamEvent } from "../../src/core/events";
import { disableConsoleLog, enableConsoleLog } from "../helper";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

class SpecialEvent extends Event<{ foo: string }> {
   static override slug = "special-event";

   isBar() {
      return this.params.foo === "bar";
   }
}

class InformationalEvent extends NoParamEvent {
   static override slug = "informational-event";
}

class ReturnEvent extends Event<{ foo: string }, string> {
   static override slug = "return-event";

   override validate(value: string) {
      if (typeof value !== "string") {
         throw new InvalidEventReturn("string", typeof value);
      }

      return this.clone({
         foo: [this.params.foo, value].join("-"),
      });
   }
}

describe("EventManager", async () => {
   test("executes", async () => {
      const call = mock(() => null);
      const delayed = mock(() => null);

      const emgr = new EventManager();
      emgr.registerEvents([SpecialEvent, InformationalEvent]);

      expect(emgr.eventExists("special-event")).toBe(true);
      expect(emgr.eventExists("informational-event")).toBe(true);
      expect(emgr.eventExists("unknown-event")).toBe(false);

      emgr.onEvent(
         SpecialEvent,
         async (event, name) => {
            expect(name).toBe("special-event");
            expect(event.isBar()).toBe(true);
            call();
            await new Promise((resolve) => setTimeout(resolve, 50));
            delayed();
         },
         "sync",
      );

      // don't allow unknown
      expect(() => emgr.on("unknown", () => void 0)).toThrow();

      emgr.onEvent(InformationalEvent, async (event, name) => {
         call();
         expect(name).toBe("informational-event");
      });

      await emgr.emit(new SpecialEvent({ foo: "bar" }));
      await emgr.emit(new InformationalEvent());

      // expect construct signatures to not cause ts errors
      new SpecialEvent({ foo: "bar" });
      new InformationalEvent();

      // execute asyncs
      await emgr.executeAsyncs();

      expect(call).toHaveBeenCalledTimes(2);
      expect(delayed).toHaveBeenCalled();
   });

   test("custom async executor", async () => {
      const call = mock(() => null);
      const asyncExecutor = (p: Promise<any>[]) => {
         call();
         return Promise.all(p);
      };
      const emgr = new EventManager({ InformationalEvent });

      emgr.onEvent(InformationalEvent, async () => {});
      await emgr.emit(new InformationalEvent());
      await emgr.executeAsyncs(asyncExecutor);
      expect(call).toHaveBeenCalled();
   });

   test("piping", async () => {
      const onInvalidReturn = mock(() => null);
      const asyncEventCallback = mock(() => null);
      const emgr = new EventManager(
         { ReturnEvent, InformationalEvent },
         {
            onInvalidReturn,
         },
      );

      // @ts-expect-error InformationalEvent has no return value
      emgr.onEvent(InformationalEvent, async () => {
         asyncEventCallback();
         return 1;
      });

      emgr.onEvent(ReturnEvent, async () => "1", "sync");
      emgr.onEvent(ReturnEvent, async () => "0", "sync");

      // @todo: fix this
      // @ts-expect-error must be string
      emgr.onEvent(ReturnEvent, async () => 0, "sync");

      // return is not required
      emgr.onEvent(ReturnEvent, async () => {}, "sync");

      // was "async", will not return
      const e1 = await emgr.emit(new InformationalEvent());
      expect(e1.returned).toBe(false);

      const e2 = await emgr.emit(new ReturnEvent({ foo: "bar" }));
      expect(e2.returned).toBe(true);
      expect(e2.params.foo).toBe("bar-1-0");

      await emgr.executeAsyncs();

      expect(onInvalidReturn).toHaveBeenCalled();
      expect(asyncEventCallback).toHaveBeenCalled();
   });

   test("once", async () => {
      const call = mock(() => null);
      const emgr = new EventManager({ InformationalEvent });

      emgr.onEvent(
         InformationalEvent,
         async (event, slug) => {
            expect(event).toBeInstanceOf(InformationalEvent);
            expect(slug).toBe("informational-event");
            call();
         },
         { mode: "sync", once: true },
      );

      expect(emgr.getListeners().length).toBe(1);
      await emgr.emit(new InformationalEvent());
      expect(emgr.getListeners().length).toBe(0);
      await emgr.emit(new InformationalEvent());
      expect(emgr.getListeners().length).toBe(0);
      expect(call).toHaveBeenCalledTimes(1);
   });
});
