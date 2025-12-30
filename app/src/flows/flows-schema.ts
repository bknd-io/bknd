import { transformObject, s } from "bknd/utils";
import { TaskMap, TriggerMap } from "flows";

export const TASKS = {
   ...TaskMap,
} as const;

export const TRIGGERS = TriggerMap;

const taskSchemaObject = transformObject(TASKS, (task, name) => {
   return s.strictObject(
      {
         type: s.literal(name),
         params: task.cls.schema,
      },
      { title: String(name) },
   );
});
const taskSchema = s.anyOf(Object.values(taskSchemaObject));
export type TAppFlowTaskSchema = s.Static<typeof taskSchema>;

const triggerSchemaObject = transformObject(TRIGGERS, (trigger, name) => {
   return s.strictObject(
      {
         type: s.literal(name),
         config: trigger.cls.schema.optional(),
      },
      { title: String(name) },
   );
});
const triggerSchema = s.anyOf(Object.values(triggerSchemaObject));
export type TAppFlowTriggerSchema = s.Static<typeof triggerSchema>;

const connectionSchema = s.strictObject({
   source: s.string(),
   target: s.string(),
   config: s
      .strictObject({
         condition: s.anyOf([
            s.strictObject({ type: s.literal("success") }, { title: "success" }),
            s.strictObject({ type: s.literal("error") }, { title: "error" }),
            s.strictObject(
               { type: s.literal("matches"), path: s.string(), value: s.string() },
               { title: "matches" },
            ),
         ]),
         max_retries: s.number(),
      })
      .partial(),
});

// @todo: rework to have fixed ids per task and connections (and preferrably arrays)
// causes issues with canvas
export const flowSchema = s.strictObject({
   trigger: s.anyOf(Object.values(triggerSchemaObject)),
   tasks: s.record(s.anyOf(Object.values(taskSchemaObject))).optional(),
   connections: s.record(connectionSchema).optional(),
   start_task: s.string().optional(),
   responding_task: s.string().optional(),
});
export type TAppFlowSchema = s.Static<typeof flowSchema>;

export const flowsConfigSchema = s.strictObject({
   basepath: s.string({ default: "/api/flows" }),
   flows: s.record(flowSchema, { default: {} }),
});
