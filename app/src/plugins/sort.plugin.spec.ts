import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { sort } from "./sort.plugin";
import { em, entity, text, number } from "bknd";
import { createApp } from "core/test/utils";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(() => disableConsoleLog());
afterAll(enableConsoleLog);

describe("sort plugin", () => {
   test("should add sort field to configured entities", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const taskEntity = app.em.entity("tasks");
      expect(taskEntity).toBeDefined();
      expect(taskEntity?.fields.map((f) => f.name)).toContain("position");
      expect(taskEntity?.field("position")?.type).toBe("number");
   });

   test("should auto-assign sort values on insert (starting from 0)", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // insert first item
      const { data: task1 } = await mutator.insertOne({ title: "Task 1" });
      expect(task1.position).toBe(0);

      // insert second item
      const { data: task2 } = await mutator.insertOne({ title: "Task 2" });
      expect(task2.position).toBe(1);

      // insert third item
      const { data: task3 } = await mutator.insertOne({ title: "Task 3" });
      expect(task3.position).toBe(2);
   });

   test("should preserve manually set sort values on insert", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // insert with explicit position
      const { data: task } = await mutator.insertOne({ title: "Task 1", position: 10 });
      expect(task.position).toBe(10);
   });

   test("should reorder items via API endpoint", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create tasks at positions 0, 1, 2
      const { data: task1 } = await mutator.insertOne({ title: "Task 1" });
      const { data: task2 } = await mutator.insertOne({ title: "Task 2" });
      const { data: task3 } = await mutator.insertOne({ title: "Task 3" });

      // move task3 (position 2) to position 0
      const res = await app.server.request("/api/sort/tasks/reorder", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ id: task3.id, position: 0 }),
      });

      expect(res.status).toBe(200);

      // verify positions
      const repo = app.em.repo("tasks");
      const { data: updatedTask1 } = await repo.findOne({ id: task1.id });
      const { data: updatedTask2 } = await repo.findOne({ id: task2.id });
      const { data: updatedTask3 } = await repo.findOne({ id: task3.id });

      expect(updatedTask3.position).toBe(0); // moved to position 0
      expect(updatedTask1.position).toBe(1); // shifted down
      expect(updatedTask2.position).toBe(2); // shifted down
   });

   test("should automatically reorder when updating sort field directly", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create tasks at positions 0, 1, 2, 3
      const { data: task1 } = await mutator.insertOne({ title: "Task 1" });
      const { data: task2 } = await mutator.insertOne({ title: "Task 2" });
      const { data: task3 } = await mutator.insertOne({ title: "Task 3" });
      const { data: task4 } = await mutator.insertOne({ title: "Task 4" });

      // move task4 (position 3) to position 1 by updating directly
      await mutator.updateOne(task4.id, { position: 1 });

      // verify positions
      const repo = app.em.repo("tasks");
      const { data: updatedTask1 } = await repo.findOne({ id: task1.id });
      const { data: updatedTask2 } = await repo.findOne({ id: task2.id });
      const { data: updatedTask3 } = await repo.findOne({ id: task3.id });
      const { data: updatedTask4 } = await repo.findOne({ id: task4.id });

      expect(updatedTask1.position).toBe(0); // unchanged
      expect(updatedTask2.position).toBe(2); // shifted down
      expect(updatedTask3.position).toBe(3); // shifted down
      expect(updatedTask4.position).toBe(1); // moved to position 1
   });

   test("should automatically reorder when moving items up", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create tasks at positions 0, 1, 2, 3
      const { data: task1 } = await mutator.insertOne({ title: "Task 1" });
      const { data: task2 } = await mutator.insertOne({ title: "Task 2" });
      const { data: task3 } = await mutator.insertOne({ title: "Task 3" });
      const { data: task4 } = await mutator.insertOne({ title: "Task 4" });

      // move task1 (position 0) to position 2 by updating directly
      await mutator.updateOne(task1.id, { position: 2 });

      // verify positions
      const repo = app.em.repo("tasks");
      const { data: updatedTask1 } = await repo.findOne({ id: task1.id });
      const { data: updatedTask2 } = await repo.findOne({ id: task2.id });
      const { data: updatedTask3 } = await repo.findOne({ id: task3.id });
      const { data: updatedTask4 } = await repo.findOne({ id: task4.id });

      expect(updatedTask1.position).toBe(2); // moved to position 2
      expect(updatedTask2.position).toBe(0); // shifted up
      expect(updatedTask3.position).toBe(1); // shifted up
      expect(updatedTask4.position).toBe(3); // unchanged
   });

   test("should support scoped sorting", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
                  project_id: number(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                        scope: "project_id",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create tasks in project 1
      const { data: p1t1 } = await mutator.insertOne({
         title: "P1 Task 1",
         project_id: 1,
      });
      const { data: p1t2 } = await mutator.insertOne({
         title: "P1 Task 2",
         project_id: 1,
      });

      // create tasks in project 2
      const { data: p2t1 } = await mutator.insertOne({
         title: "P2 Task 1",
         project_id: 2,
      });
      const { data: p2t2 } = await mutator.insertOne({
         title: "P2 Task 2",
         project_id: 2,
      });

      // positions should be scoped per project
      expect(p1t1.position).toBe(0);
      expect(p1t2.position).toBe(1);
      expect(p2t1.position).toBe(0); // resets for new scope
      expect(p2t2.position).toBe(1);
   });

   test("should reorder only within scope", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
                  project_id: number(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                        scope: "project_id",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create tasks in project 1
      const { data: p1t1 } = await mutator.insertOne({
         title: "P1 Task 1",
         project_id: 1,
      });
      const { data: p1t2 } = await mutator.insertOne({
         title: "P1 Task 2",
         project_id: 1,
      });
      const { data: p1t3 } = await mutator.insertOne({
         title: "P1 Task 3",
         project_id: 1,
      });

      // create tasks in project 2
      const { data: p2t1 } = await mutator.insertOne({
         title: "P2 Task 1",
         project_id: 2,
      });
      const { data: p2t2 } = await mutator.insertOne({
         title: "P2 Task 2",
         project_id: 2,
      });

      // move p1t3 to position 0 (should only affect project 1)
      await app.server.request("/api/sort/tasks/reorder", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ id: p1t3.id, position: 0 }),
      });

      // verify project 1 tasks
      const repo = app.em.repo("tasks");
      const { data: updatedP1t1 } = await repo.findOne({ id: p1t1.id });
      const { data: updatedP1t2 } = await repo.findOne({ id: p1t2.id });
      const { data: updatedP1t3 } = await repo.findOne({ id: p1t3.id });

      expect(updatedP1t3.position).toBe(0); // moved to position 0
      expect(updatedP1t1.position).toBe(1); // shifted
      expect(updatedP1t2.position).toBe(2); // shifted

      // verify project 2 tasks are unchanged
      const { data: updatedP2t1 } = await repo.findOne({ id: p2t1.id });
      const { data: updatedP2t2 } = await repo.findOne({ id: p2t2.id });

      expect(updatedP2t1.position).toBe(0); // unchanged
      expect(updatedP2t2.position).toBe(1); // unchanged
   });

   test("should recalculate all positions", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create tasks with irregular positions
      await mutator.insertOne({ title: "Task 1", position: 5 });
      await mutator.insertOne({ title: "Task 2", position: 10 });
      await mutator.insertOne({ title: "Task 3", position: 15 });
      await mutator.insertOne({ title: "Task 4", position: 100 });

      // recalculate
      const res = await app.server.request("/api/sort/tasks/recalculate", {
         method: "POST",
         body: JSON.stringify({}),
         headers: {
            "Content-Type": "application/json",
         },
      });

      expect(res.status).toBe(200);

      // verify positions are now 0, 1, 2, 3
      const { data: tasks } = await app.em.repo("tasks").findMany({
         orderBy: [{ position: "asc" }],
      });

      expect(tasks.length).toBe(4);
      expect(tasks[0].position).toBe(0);
      expect(tasks[1].position).toBe(1);
      expect(tasks[2].position).toBe(2);
      expect(tasks[3].position).toBe(3);
   });

   test("should recalculate positions within scope only", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
                  project_id: number(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                        scope: "project_id",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create tasks in project 1 with irregular positions
      await mutator.insertOne({ title: "P1 Task 1", project_id: 1, position: 5 });
      await mutator.insertOne({ title: "P1 Task 2", project_id: 1, position: 15 });

      // create tasks in project 2 with irregular positions
      await mutator.insertOne({ title: "P2 Task 1", project_id: 2, position: 10 });
      await mutator.insertOne({ title: "P2 Task 2", project_id: 2, position: 20 });

      // recalculate only project 1
      const res = await app.server.request("/api/sort/tasks/recalculate", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ scope: 1 }),
      });

      expect(res.status).toBe(200);

      // verify project 1 tasks are recalculated
      const { data: p1Tasks } = await app.em.repo("tasks").findMany({
         where: { project_id: 1 },
         orderBy: [{ position: "asc" }],
      });

      expect(p1Tasks.length).toBe(2);
      expect(p1Tasks[0].position).toBe(0);
      expect(p1Tasks[1].position).toBe(1);

      // verify project 2 tasks are unchanged
      const { data: p2Tasks } = await app.em.repo("tasks").findMany({
         where: { project_id: 2 },
         orderBy: [{ position: "asc" }],
      });

      expect(p2Tasks.length).toBe(2);
      expect(p2Tasks[0].position).toBe(10); // unchanged
      expect(p2Tasks[1].position).toBe(20); // unchanged
   });

   test("should handle moving items to the end", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create tasks at positions 0, 1, 2, 3
      const { data: task1 } = await mutator.insertOne({ title: "Task 1" });
      const { data: task2 } = await mutator.insertOne({ title: "Task 2" });
      const { data: task3 } = await mutator.insertOne({ title: "Task 3" });
      const { data: task4 } = await mutator.insertOne({ title: "Task 4" });

      // move task1 to the end (position 3)
      await app.server.request("/api/sort/tasks/reorder", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ id: task1.id, position: 3 }),
      });

      // verify positions
      const repo = app.em.repo("tasks");
      const { data: updatedTask1 } = await repo.findOne({ id: task1.id });
      const { data: updatedTask2 } = await repo.findOne({ id: task2.id });
      const { data: updatedTask3 } = await repo.findOne({ id: task3.id });
      const { data: updatedTask4 } = await repo.findOne({ id: task4.id });

      expect(updatedTask1.position).toBe(3); // moved to end
      expect(updatedTask2.position).toBe(0); // shifted up
      expect(updatedTask3.position).toBe(1); // shifted up
      expect(updatedTask4.position).toBe(2); // shifted up
   });

   test("should return 400 for invalid item id", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const res = await app.server.request("/api/sort/tasks/reorder", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ id: 999999, position: 0 }),
      });

      expect(res.status).toBe(400);
   });

   test("should handle multiple entities with different configurations", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
               categories: entity("categories", {
                  name: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                     categories: {
                        field: "order",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      // verify both entities have their sort fields
      const taskEntity = app.em.entity("tasks");
      const categoryEntity = app.em.entity("categories");

      expect(taskEntity?.fields.map((f) => f.name)).toContain("position");
      expect(categoryEntity?.fields.map((f) => f.name)).toContain("order");

      // create items in both entities
      const { data: task } = await app.em.mutator("tasks").insertOne({ title: "Task 1" });
      const { data: category } = await app.em.mutator("categories").insertOne({ name: "Cat 1" });

      expect(task.position).toBe(0);
      expect(category.order).toBe(0);

      // verify both endpoints exist
      const taskRes = await app.server.request("/api/sort/tasks/recalculate", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({}),
      });
      const catRes = await app.server.request("/api/sort/categories/recalculate", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({}),
      });

      expect(taskRes.status).toBe(200);
      expect(catRes.status).toBe(200);
   });

   test("should not trigger reorder when updating other fields", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create tasks
      const { data: task1 } = await mutator.insertOne({ title: "Task 1" });
      const { data: task2 } = await mutator.insertOne({ title: "Task 2" });
      const { data: task3 } = await mutator.insertOne({ title: "Task 3" });

      // update title only (should not trigger reordering)
      await mutator.updateOne(task2.id, { title: "Task 2 Updated" });

      // verify positions are unchanged
      const repo = app.em.repo("tasks");
      const { data: updatedTask1 } = await repo.findOne({ id: task1.id });
      const { data: updatedTask2 } = await repo.findOne({ id: task2.id });
      const { data: updatedTask3 } = await repo.findOne({ id: task3.id });

      expect(updatedTask1.position).toBe(0);
      expect(updatedTask2.position).toBe(1);
      expect(updatedTask2.title).toBe("Task 2 Updated");
      expect(updatedTask3.position).toBe(2);
   });

   test("should handle null sort values", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create task with null position (bypass listener by using kysely directly)
      await app.connection.kysely
         .insertInto("tasks")
         .values({ title: "Task with null", position: null })
         .execute();

      // create normal task
      const { data: task2 } = await mutator.insertOne({ title: "Task 2" });

      // update the null task to have a position
      const nullTask = await app.connection.kysely
         .selectFrom("tasks")
         .selectAll()
         .where("title", "=", "Task with null")
         .executeTakeFirst();

      await mutator.updateOne(nullTask!.id, { position: 0 });

      // verify both tasks have proper positions
      const { data: tasks } = await app.em.repo("tasks").findMany({
         sort: { by: "position", dir: "asc" },
      });

      expect(tasks.length).toBe(2);
      expect(tasks[0].position).toBe(0);
      expect(tasks[1].position).toBe(1);
   });

   test("should not create duplicates when moving to an occupied position", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create two tasks at positions 0 and 1
      const { data: task1 } = await mutator.insertOne({ title: "Task 1" });
      const { data: task2 } = await mutator.insertOne({ title: "Task 2" });

      expect(task1.position).toBe(0);
      expect(task2.position).toBe(1);

      // move task2 (at position 1) to position 0
      await mutator.updateOne(task2.id, { position: 0 });

      // verify no duplicates
      const { data: tasks } = await app.em.repo("tasks").findMany({
         sort: { by: "position", dir: "asc" },
      });
      console.dir(tasks, { depth: null });

      expect(tasks.length).toBe(2);
      expect(tasks[0].id).toBe(task2.id);
      expect(tasks[0].position).toBe(0);
      expect(tasks[1].id).toBe(task1.id);
      expect(tasks[1].position).toBe(1);

      // verify no tasks have the same position
      const positions = tasks.map((t) => t.position);
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(positions.length);
   });

   test("should preserve order when recalculating", async () => {
      const app = createApp({
         config: {
            data: em({
               tasks: entity("tasks", {
                  title: text(),
               }),
            }).toJSON(),
         },
         options: {
            plugins: [
               sort({
                  entities: {
                     tasks: {
                        field: "position",
                     },
                  },
               }),
            ],
         },
      });
      await app.build();

      const mutator = app.em.mutator("tasks");

      // create tasks with specific positions
      const { data: taskA } = await mutator.insertOne({ title: "Task A", position: 5 });
      const { data: taskB } = await mutator.insertOne({ title: "Task B", position: 3 });
      const { data: taskC } = await mutator.insertOne({ title: "Task C", position: 10 });

      // recalculate
      await app.server.request("/api/sort/tasks/recalculate", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({}),
      });

      // verify order is preserved (B, A, C based on original positions)
      const { data: tasks } = await app.em.repo("tasks").findMany({
         sort: { by: "position", dir: "asc" },
      });

      expect(tasks[0].id).toBe(taskB.id); // was at 3, now at 0
      expect(tasks[0].position).toBe(0);
      expect(tasks[1].id).toBe(taskA.id); // was at 5, now at 1
      expect(tasks[1].position).toBe(1);
      expect(tasks[2].id).toBe(taskC.id); // was at 10, now at 2
      expect(tasks[2].position).toBe(2);
   });
});
