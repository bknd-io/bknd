import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { Event, EventManager } from "../../src/core/events";
import { s, parse } from "core/utils/schema";
import { EventTrigger, Flow, HttpTrigger, type InputsMap, Task } from "../../src/flows";
import { dynamic } from "../../src/flows/tasks/Task";

class Passthrough extends Task {
   type = "passthrough";

   async execute(inputs: Map<string, any>) {
      //console.log("executing passthrough", this.name, inputs);
      return Array.from(inputs.values()).pop().output + "/" + this.name;
   }
}

type OutputIn = s.Static<typeof OutputParamTask.schema>;
type OutputOut = s.StaticCoerced<typeof OutputParamTask.schema>;

class OutputParamTask extends Task<typeof OutputParamTask.schema> {
   type = "output-param";

   static override schema = s.strictObject({
      number: dynamic(
         s.number({
            title: "Output number",
         }),
         Number.parseInt,
      ),
   });

   async execute(inputs: InputsMap) {
      //console.log("--***--- executing output", this.params);
      return this.params.number;
   }
}

class PassthroughFlowInput extends Task {
   type = "passthrough-flow-input";

   async execute(inputs: InputsMap) {
      return inputs.get("flow")?.output;
   }
}

describe.skip("Flow task inputs", async () => {
   test("types", async () => {
      const schema = OutputParamTask.schema;

      expect(parse(schema, { number: 123 })).toBeDefined();
      expect(parse(schema, { number: "{{ some.path }}" })).toBeDefined();

      const task = new OutputParamTask("", { number: 123 });
      expect(task.params.number).toBe(123);
   });

   test("passthrough", async () => {
      const task = new Passthrough("log");
      const task2 = new Passthrough("log_2");

      const flow = new Flow("test", [task, task2]);
      flow.task(task).asInputFor(task2);
      flow.setRespondingTask(task2);

      const exec = await flow.start("pass-through");

      /*console.log(
         "---- log",
         exec.logs.map(({ task, ...l }) => ({ ...l, ...task.toJSON() })),
      );
      console.log("---- result", exec.getResponse());*/
      expect(exec.getResponse()).toBe("pass-through/log/log_2");
   });

   test("output/input", async () => {
      const task = new OutputParamTask("task1", { number: 111 });
      const task2 = new OutputParamTask("task2", {
         number: "{{ task1.output }}",
      });

      const flow = new Flow("test", [task, task2]);
      flow.task(task).asInputFor(task2);
      flow.setRespondingTask(task2);

      const exec = await flow.start();

      /*console.log(
         "---- log",
         exec.logs.map(({ task, ...l }) => ({ ...l, ...task.toJSON() })),
      );
      console.log("---- result", exec.getResponse());*/
      expect(exec.getResponse()).toBe(111);
   });

   test("input from flow", async () => {
      const task = new OutputParamTask("task1", {
         number: "{{flow.output.someFancyParam}}",
      });
      const task2 = new OutputParamTask("task2", {
         number: "{{task1.output}}",
      });

      const flow = new Flow("test", [task, task2]);
      flow.task(task).asInputFor(task2);
      flow.setRespondingTask(task2);

      // expect to throw because of missing input
      //expect(flow.start()).rejects.toThrow();

      const exec = await flow.start({ someFancyParam: 123 });

      /*console.log(
         "---- log",
         exec.logs.map(({ task, ...l }) => ({ ...l, ...task.toJSON() })),
      );
      console.log("---- result", exec.getResponse());*/

      expect(exec.getResponse()).toBe(123);
   });

   test("manual event trigger with inputs", async () => {
      class EventTriggerClass extends Event<{ number: number }> {
         static override slug = "test-event";
      }

      const emgr = new EventManager({ EventTriggerClass });

      const task = new OutputParamTask("event", {
         number: "{{flow.output.number}}",
      });
      const flow = new Flow(
         "test",
         [task],
         [],
         new EventTrigger({
            event: "test-event",
            mode: "sync",
         }),
      );
      flow.setRespondingTask(task);
      flow.trigger.register(flow, emgr);

      await emgr.emit(new EventTriggerClass({ number: 120 }));
      const execs = flow.trigger.executions;
      expect(execs.length).toBe(1);
      expect(execs[0]!.getResponse()).toBe(120);
   });

   test("http trigger with response", async () => {
      const task = new PassthroughFlowInput("");
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

      const res = await hono.request("/test?input=123");
      const data = await res.json();
      //console.log("response", data);
      const execs = flow.trigger.executions;
      expect(execs.length).toBe(1);
      expect(execs[0]!.getResponse()).toBeInstanceOf(Request);
      expect(execs[0]!.getResponse()?.url).toBe("http://localhost/test?input=123");
   });
});
