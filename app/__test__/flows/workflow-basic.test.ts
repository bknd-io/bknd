// eslint-disable-next-line import/no-unresolved
import { describe, expect, test } from "bun:test";
import { isEqual } from "lodash-es";
import { _jsonp, withDisabledConsole } from "../../src/core/utils";
import { type Static, Type } from "@sinclair/typebox";
import { Condition, ExecutionEvent, FetchTask, Flow, LogTask, Task } from "../../src/flows";

/*beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);*/

class ExecTask extends Task<typeof ExecTask.schema> {
   type = "exec";

   static override schema = Type.Object({
      delay: Type.Number({ default: 10 }),
   });

   constructor(
      name: string,
      params: Static<typeof ExecTask.schema>,
      private func: () => Promise<any>,
   ) {
      super(name, params);
   }

   override clone(name: string, params: Static<typeof ExecTask.schema>) {
      return new ExecTask(name, params, this.func);
   }

   async execute() {
      await new Promise((resolve) => setTimeout(resolve, this.params.delay ?? 0));
      return await this.func();
   }
}

function getTask(num: number = 0, delay: number = 5) {
   return new ExecTask(
      `Task ${num}`,
      {
         delay,
      },
      async () => {
         //console.log(`[DONE] Task: ${num}`);
         return true;
      },
   );
   //return new LogTask(`Log ${num}`, { delay });
}

function getNamedTask(name: string, _func?: () => Promise<any>, delay?: number) {
   const func =
      _func ??
      (async () => {
         //console.log(`[DONE] Task: ${name}`);
         return true;
      });
   return new ExecTask(
      name,
      {
         delay: delay ?? 0,
      },
      func,
   );
}

function getObjectDiff(obj1, obj2) {
   const diff = Object.keys(obj1).reduce((result, key) => {
      // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
      if (!obj2.hasOwnProperty(key)) {
         result.push(key);
      } else if (isEqual(obj1[key], obj2[key])) {
         const resultKeyIndex = result.indexOf(key);
         result.splice(resultKeyIndex, 1);
      }
      return result;
   }, Object.keys(obj2));

   return diff;
}

describe("Flow tests", async () => {
   test("Simple single task", async () => {
      const simple = getTask(0);

      const result = await simple.run();
      expect(result.success).toBe(true);
      // @todo: add more
   });

   function getNamedQueue(flow: Flow) {
      const namedSequence = flow.getSequence().map((step) => step.map((t) => t.name));
      //console.log(namedSequence);
      return namedSequence;
   }

   test("Simple flow", async () => {
      const first = getTask(0);
      const second = getTask(1);

      // simple
      const simple = new Flow("simple", [first, second]);
      simple.task(first).asInputFor(second);
      expect(getNamedQueue(simple)).toEqual([["Task 0"], ["Task 1"]]);
      expect(simple.task(first).getDepth()).toBe(0);
      expect(simple.task(second).getDepth()).toBe(1);

      const execution = simple.createExecution();
      await execution.start();

      //console.log("execution", execution.logs);
      //process.exit(0);
      expect(execution.logs.length).toBe(2);
      expect(execution.logs.every((log) => log.success)).toBe(true);
   });

   test("Test connection uniqueness", async () => {
      const first = getTask(0);
      const second = getTask(1);
      const third = getTask(2, 5);
      const fourth = getTask(3);

      // should be fine
      expect(() => {
         const condition = new Flow("", [first, second, third]);
         condition.task(first).asInputFor(second);
         condition.task(first).asInputFor(third);
      }).toBeDefined();

      // should throw
      expect(() => {
         const condition = new Flow("", [first, second, third]);
         condition.task(first).asInputFor(second);
         condition.task(first).asInputFor(second);
      }).toThrow();

      expect(() => {
         const condition = new Flow("", [first, second, third]);
         condition.task(first).asInputFor(second);
         condition.task(second).asInputFor(third);
         condition.task(third).asInputFor(second);
         condition.task(third).asInputFor(fourth); // this should fail
      }).toThrow();

      expect(() => {
         const condition = new Flow("", [first, second, third]);
         condition.task(first).asInputFor(second);
         condition.task(second).asInputFor(third);
         condition.task(third).asInputFor(second);
         condition.task(third).asInputFor(fourth, Condition.error());
      }).toBeDefined();
   });

   test("Flow with 3 steps", async () => {
      const first = getTask(0);
      const second = getTask(1);
      const third = getTask(2);

      const three = new Flow("", [first, second, third]);
      three.task(first).asInputFor(second);
      three.task(second).asInputFor(third);
      expect(getNamedQueue(three)).toEqual([["Task 0"], ["Task 1"], ["Task 2"]]);
      expect(three.task(first).getDepth()).toBe(0);
      expect(three.task(second).getDepth()).toBe(1);
      expect(three.task(third).getDepth()).toBe(2);

      const execution = three.createExecution();
      await execution.start();

      expect(execution.logs.length).toBe(3);
      expect(execution.logs.every((log) => log.success)).toBe(true);
   });

   test("Flow with parallel tasks", async () => {
      const first = getTask(0);
      const second = getTask(1);
      const third = getTask(2);
      const fourth = getTask(3);
      const fifth = getTask(4); // without connection

      const parallel = new Flow("", [first, second, third, fourth, fifth]);
      parallel.task(first).asInputFor(second);
      parallel.task(first).asInputFor(third);
      parallel.task(third).asInputFor(fourth);
      expect(getNamedQueue(parallel)).toEqual([["Task 0"], ["Task 1", "Task 2"], ["Task 3"]]);
      expect(parallel.task(first).getDepth()).toBe(0);
      expect(parallel.task(second).getDepth()).toBe(1);
      expect(parallel.task(third).getDepth()).toBe(1);
      expect(parallel.task(fourth).getDepth()).toBe(2);

      const execution = parallel.createExecution();
      await execution.start();

      expect(execution.logs.length).toBe(4);
      expect(execution.logs.every((log) => log.success)).toBe(true);
   });

   test("Flow with condition", async () => {
      const first = getTask(0);
      const second = getTask(1);
      const third = getTask(2);

      const condition = new Flow("", [first, second, third]);
      condition.task(first).asInputFor(second);
      condition.task(first).asInputFor(third);
   });

   test("Flow with back step", async () => {
      const first = getNamedTask("first");
      const second = getNamedTask("second");
      const fourth = getNamedTask("fourth");

      let thirdRuns: number = 0;
      const third = getNamedTask("third", async () => {
         thirdRuns++;
         if (thirdRuns === 4) {
            return true;
         }

         throw new Error("Third failed");
      });

      const back = new Flow("", [first, second, third, fourth]);
      back.task(first).asInputFor(second);
      back.task(second).asInputFor(third);
      back.task(third).asInputFor(second, Condition.error(), 2);
      back.task(third).asInputFor(fourth, Condition.success());
      expect(getNamedQueue(back)).toEqual([["first"], ["second"], ["third"], ["fourth"]]);
      expect(
         back
            .task(third)
            .getOutTasks()
            .map((t) => t.name),
      ).toEqual(["second", "fourth"]);

      const execution = back.createExecution();
      withDisabledConsole(async () => {
         expect(execution.start()).rejects.toThrow();
      });
   });

   test("Flow with back step: enough retries", async () => {
      const first = getNamedTask("first");
      const second = getNamedTask("second");
      const fourth = getNamedTask("fourth");

      let thirdRuns: number = 0;
      const third = getNamedTask("third", async () => {
         thirdRuns++;
         //console.log("--- third runs", thirdRuns);
         if (thirdRuns === 2) {
            return true;
         }

         throw new Error("Third failed");
      });

      const back = new Flow("", [first, second, third, fourth]);
      back.task(first).asInputFor(second);
      back.task(second).asInputFor(third);
      back.task(third).asInputFor(second, Condition.error(), 1);
      back.task(third).asInputFor(fourth, Condition.success());
      expect(getNamedQueue(back)).toEqual([["first"], ["second"], ["third"], ["fourth"]]);
      expect(
         back
            .task(third)
            .getOutTasks()
            .map((t) => t.name),
      ).toEqual(["second", "fourth"]);

      const execution = back.createExecution();
      await execution.start();
   });

   test("flow fanout", async () => {
      const first = getTask(0);
      const second = getTask(1);
      const third = getTask(2, 20);

      const fanout = new Flow("", [first, second, third]);
      fanout.task(first).asInputFor(second);
      fanout.task(first).asInputFor(third);

      const execution = fanout.createExecution();
      await execution.start();

      expect(execution.logs.length).toBe(3);
      expect(execution.logs.every((log) => log.success)).toBe(true);
   });

   test("flow fanout with condition", async () => {
      const first = getTask(0);
      const second = getTask(1);
      const third = getTask(2);

      const fanout = new Flow("", [first, second, third]);
      fanout.task(first).asInputFor(second, Condition.success());
      fanout.task(first).asInputFor(third, Condition.error());

      const execution = fanout.createExecution();
      await execution.start();

      expect(execution.logs.length).toBe(2);
      expect(execution.logs.every((log) => log.success)).toBe(true);
   });

   test("flow fanout with condition error", async () => {
      const first = getNamedTask("first", async () => {
         throw new Error("Error");
      });
      const second = getNamedTask("second");
      const third = getNamedTask("third");

      const fanout = new Flow("", [first, second, third]);
      fanout.task(first).asInputFor(third, Condition.error());
      fanout.task(first).asInputFor(second, Condition.success());

      const execution = fanout.createExecution();
      await execution.start();

      expect(execution.logs.length).toBe(2);
      expect(execution.logs.map((l) => l.task.name)).toEqual(["first", "third"]);
   });

   test("flow fanout with condition matches", async () => {
      const first = getNamedTask("first", async () => {
         return {
            inner: {
               result: 2,
            },
         };
      });
      const second = getNamedTask("second");
      const third = getNamedTask("third");

      const fanout = new Flow("", [first, second, third]);
      fanout.task(first).asInputFor(third, Condition.error());
      fanout.task(first).asInputFor(second, Condition.matches("inner.result", 2));

      const execution = fanout.createExecution();
      await execution.start();

      expect(execution.logs.length).toBe(2);
      expect(execution.logs.map((l) => l.task.name)).toEqual(["first", "second"]);
   });

   test("flow: responding task", async () => {
      const first = getNamedTask("first");
      const second = getNamedTask("second", async () => ({ result: 2 }));
      const third = getNamedTask("third");

      const flow = new Flow("", [first, second, third]);
      flow.task(first).asInputFor(second);
      flow.task(second).asInputFor(third);

      flow.setRespondingTask(second);

      const execution = flow.createExecution();

      execution.subscribe(async (event) => {
         if (event instanceof ExecutionEvent) {
            console.log(
               "[event]",
               event.isStart() ? "start" : "end",
               event.task().name,
               event.isStart() ? undefined : event.succeeded(),
            );
         }
      });

      await execution.start();

      const response = execution.getResponse();

      expect(response).toEqual({ result: 2 });
      expect(execution.logs.length).toBe(2);
      expect(execution.logs.map((l) => l.task.name)).toEqual(["first", "second"]);

      /*console.log("response", response);
      console.log("execution.logs.length", execution.logs.length);
      console.log(
         "executed",
         execution.logs.map((l) => l.task.name),
      );*/
      /*expect(execution.logs.length).toBe(3);
      expect(execution.logs.every((log) => log.success)).toBe(true);*/
   });

   test("serialize/deserialize", async () => {
      const first = new LogTask("Task 0");
      const second = new LogTask("Task 1");
      const third = new LogTask("Task 2", { delay: 50 });
      const fourth = new FetchTask("Fetch Something", {
         url: "https://jsonplaceholder.typicode.com/todos/1",
      });
      const fifth = new LogTask("Task 4"); // without connection

      const flow = new Flow("", [first, second, third, fourth, fifth]);
      flow.task(first).asInputFor(second);
      flow.task(first).asInputFor(third);
      flow.task(fourth).asOutputFor(third, Condition.matches("some", 1));

      flow.setRespondingTask(fourth);

      const original = flow.toJSON();
      //console.log("flow", original);
      // @todo: fix
      const deserialized = Flow.fromObject("", original, {
         fetch: { cls: FetchTask },
         log: { cls: LogTask },
      } as any);

      const diffdeep = getObjectDiff(original, deserialized.toJSON());
      expect(diffdeep).toEqual([]);

      expect(flow.startTask.name).toEqual(deserialized.startTask.name);
      expect(flow.respondingTask?.name).toEqual(
         // @ts-ignore
         deserialized.respondingTask?.name,
      );

      //console.log("--- creating original sequence");
      const originalSequence = flow.getSequence();
      //console.log("--- creating deserialized sequence");
      const deserializedSequence = deserialized.getSequence();
      //console.log("--- ");

      expect(originalSequence).toEqual(deserializedSequence);
   });

   test("error end", async () => {
      const first = getNamedTask("first", async () => "first");
      const second = getNamedTask("error", async () => {
         throw new Error("error");
      });
      const third = getNamedTask("third", async () => "third");
      const errorhandlertask = getNamedTask("errorhandler", async () => "errorhandler");

      const flow = new Flow("", [first, second, third, errorhandlertask]);
      flow.task(first).asInputFor(second);
      flow.task(second).asInputFor(third);
      flow.task(second).asInputFor(errorhandlertask, Condition.error());

      const exec = await flow.start();

      //console.log("logs", JSON.stringify(exec.logs, null, 2));
      //console.log("errors", exec.hasErrors(), exec.errorCount());

      expect(exec.hasErrors()).toBe(true);
      expect(exec.errorCount()).toBe(1);
      expect(exec.getResponse()).toBe("errorhandler");
   });
});
