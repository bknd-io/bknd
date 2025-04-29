import { describe, expect, test } from "bun:test";
import { Flow, LogTask, SubFlowTask, RenderTask, Task } from "../../src/flows";
import { Type } from "@sinclair/typebox";

export class StringifyTask<Output extends string> extends Task<
   typeof StringifyTask.schema,
   Output
> {
   type = "stringify";

   static override schema = Type.Optional(
      Type.Object({
         input: Type.Optional(Type.String()),
      }),
   );

   async execute() {
      return JSON.stringify(this.params.input) as Output;
   }
}

describe("SubFlowTask", async () => {
   test("Simple Subflow", async () => {
      const subTask = new RenderTask("render", {
         render: "subflow",
      });
      const subflow = new Flow("subflow", [subTask]);

      const task = new LogTask("log");
      const task2 = new SubFlowTask("sub", {
         flow: subflow,
      });
      const task3 = new RenderTask("render2", {
         render: "Subflow output: {{ sub.output }}",
      });

      const flow = new Flow("test", [task, task2, task3], []);
      flow.task(task).asInputFor(task2);
      flow.task(task2).asInputFor(task3);

      const execution = flow.createExecution();
      await execution.start();

      expect(execution.getResponse()).toEqual("Subflow output: subflow");
   });

   test("Simple loop", async () => {
      const subTask = new RenderTask("render", {
         render: "run {{ flow.output }}",
      });
      const subflow = new Flow("subflow", [subTask]);

      const task = new LogTask("log");
      const task2 = new SubFlowTask("sub", {
         flow: subflow,
         loop: true,
         input: [1, 2, 3],
      });
      const task3 = new StringifyTask("stringify", {
         input: "{{ sub.output }}",
      });

      const flow = new Flow("test", [task, task2, task3], []);
      flow.task(task).asInputFor(task2);
      flow.task(task2).asInputFor(task3);

      const execution = flow.createExecution();
      await execution.start();

      expect(execution.getResponse()).toEqual('"run 1,run 2,run 3"');
   });
});
