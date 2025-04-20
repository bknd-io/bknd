import { Const, type Static, StringRecord, transformObject } from "core/utils";
import { TaskMap, TriggerMap } from "flows";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

export const TASKS = {
   ...TaskMap,
} as const;

export const TRIGGERS = TriggerMap;

const taskSchemaObject = transformObject(TASKS, (task, name) => {
   return Type.Object(
      {
         type: Const(name),
         params: task.cls.schema,
      },
      { title: String(name), additionalProperties: false },
   );
});
const taskSchema = Type.Union(Object.values(taskSchemaObject));
export type TAppFlowTaskSchema = Static<typeof taskSchema>;

const triggerSchemaObject = transformObject(TRIGGERS, (trigger, name) => {
   return Type.Object(
      {
         type: Const(name),
         config: trigger.cls.schema,
      },
      { title: String(name), additionalProperties: false },
   );
});

const connectionSchema = Type.Object({
   source: Type.String(),
   target: Type.String(),
   config: Type.Object(
      {
         condition: Type.Optional(
            Type.Union([
               Type.Object(
                  { type: Const("success") },
                  { additionalProperties: false, title: "success" },
               ),
               Type.Object(
                  { type: Const("error") },
                  { additionalProperties: false, title: "error" },
               ),
               Type.Object(
                  { type: Const("matches"), path: Type.String(), value: Type.String() },
                  { additionalProperties: false, title: "matches" },
               ),
            ]),
         ),
         max_retries: Type.Optional(Type.Number()),
      },
      { default: {}, additionalProperties: false },
   ),
});

// @todo: rework to have fixed ids per task and connections (and preferrably arrays)
// causes issues with canvas
export const flowSchema = Type.Object(
   {
      trigger: Type.Union(Object.values(triggerSchemaObject)),
      tasks: Type.Optional(StringRecord(Type.Union(Object.values(taskSchemaObject)))),
      connections: Type.Optional(StringRecord(connectionSchema)),
      start_task: Type.Optional(Type.String()),
      responding_task: Type.Optional(Type.String()),
   },
   {
      additionalProperties: false,
   },
);
export type TAppFlowSchema = Static<typeof flowSchema>;

export const flowsConfigSchema = Type.Object(
   {
      basepath: Type.String({ default: "/api/flows" }),
      flows: StringRecord(flowSchema, { default: {} }),
   },
   {
      default: {},
      additionalProperties: false,
   },
);
