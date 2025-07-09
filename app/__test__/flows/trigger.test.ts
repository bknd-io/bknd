import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { Event, EventManager } from "../../src/core/events";
import { EventTrigger, Flow, HttpTrigger, Task } from "../../src/flows";

const ALL_TESTS = !!process.env.ALL_TESTS;

class ExecTask extends Task {
   type = "exec";

   constructor(
      name: string,
      params: any,
      private fn: () => any,
   ) {
      super(name, params);
   }

   static create(name: string, fn: () => any) {
      return new ExecTask(name, undefined, fn);
   }

   override clone(name: string, params: any) {
      return new ExecTask(name, params, this.fn);
   }

   async execute() {
      //console.log("executing", this.name);
      return await this.fn();
   }
}

describe.skip("Flow trigger", async () => {
   test("manual trigger", async () => {
      let called = false;

      const task = ExecTask.create("manual", () => {
         called = true;
      });
      const flow = new Flow("", [task]);

      expect(flow.trigger.type).toBe("manual");

      await flow.trigger.register(flow);
      expect(called).toBe(true);
   });

   test("event trigger", async () => {
      class EventTriggerClass extends Event {
         static override slug = "test-event";
      }

      const emgr = new EventManager({ EventTriggerClass });
      let called = false;

      const task = ExecTask.create("event", () => {
         called = true;
      });
      const flow = new Flow(
         "test",
         [task],
         [],
         new EventTrigger({ event: "test-event", mode: "sync" }),
      );

      flow.trigger.register(flow, emgr);

      await emgr.emit(new EventTriggerClass({ test: 1 }));
      expect(called).toBe(true);
   });

   /*test("event trigger with match", async () => {
      class EventTriggerClass extends Event<{ number: number }> {
         static slug = "test-event";
      }

      const emgr = new EventManager({ EventTriggerClass });
      let called: number = 0;

      const task = ExecTask.create("event", () => {
         called++;
      });
      const flow = new Flow(
         "test",
         [task],
         [],
         new EventTrigger(EventTriggerClass, "sync", (e) => e.params.number === 2)
      );

      flow.trigger.register(flow, emgr);

      await emgr.emit(new EventTriggerClass({ number: 1 }));
      await emgr.emit(new EventTriggerClass({ number: 2 }));
      expect(called).toBe(1);
   });*/

   test("http trigger", async () => {
      let called = false;

      const task = ExecTask.create("http", () => {
         called = true;
      });
      const flow = new Flow(
         "test",
         [task],
         [],
         new HttpTrigger({
            path: "/test",
            method: "GET",
            mode: "sync",
         }),
      );

      const hono = new Hono();

      flow.trigger.register(flow, hono);

      const res = await hono.request("/test");
      //const data = await res.json();
      //console.log("response", data);
      expect(called).toBe(true);
   });

   test("http trigger with response", async () => {
      const task = ExecTask.create("http", () => ({
         called: true,
      }));
      const flow = new Flow(
         "test",
         [task],
         [],
         new HttpTrigger({
            path: "/test",
            method: "GET",
            mode: "sync",
         }),
      );
      flow.setRespondingTask(task);

      const hono = new Hono();

      flow.trigger.register(flow, hono);

      const res = await hono.request("/test");
      const data = await res.json();
      //console.log("response", data);
      expect(data).toEqual({ called: true });
   });

   /*test.skipIf(ALL_TESTS)("template with email", async () => {
      console.log("apikey", process.env.RESEND_API_KEY);
      const task = new FetchTask("fetch", {
         url: "https://api.resend.com/emails",
         method: "POST",
         headers: [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{ flow.output.apiKey }}" }
         ],
         body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: "dennis.senn@gmail.com",
            subject:
               "test from {% if flow.output.someFancyParam > 100 %}flow{% else %}task{% endif %}!",
            html: "Hello"
         })
      });

      const flow = new Flow("test", [task]);

      const exec = await flow.start({ someFancyParam: 80, apiKey: process.env.RESEND_API_KEY });
      //console.log("exec", exec.logs, exec.finished());
      expect(exec.finished()).toBe(true);
      expect(exec.hasErrors()).toBe(false);
   });*/
});
