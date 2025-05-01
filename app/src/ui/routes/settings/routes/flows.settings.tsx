import { transform } from "lodash-es";
import { Route, Switch } from "wouter";
import { useBknd } from "../../../client/BkndProvider";
import { Setting } from "../components/Setting";

const uiSchema = {
   jwt: {
      basepath: {
         "ui:options": {
            label: false,
         },
      },
      fields: {
         "ui:options": {
            orderable: false,
         },
      },
   },
   strategies: {
      additionalProperties: {
         "ui:widget": "select",
         type: {
            "ui:widget": "hidden",
         },
      },
      type: {
         "ui:widget": "hidden",
      },
   },
};

export const FlowsSettings = ({ schema, config }) => {
   const { app } = useBknd();
   const prefix = app.getAbsolutePath("settings");

   function fillTasks(schema: any, flow: any, key: string) {
      const tasks = Object.keys(flow.tasks ?? {});

      if (tasks.length === 0) return;
      if (schema.properties && key in schema.properties) {
         schema.properties[key].enum = tasks;
      }
      if ("anyOf" in schema) {
         schema.anyOf.forEach((s) => fillTasks(s, flow, key));
      }
   }

   return (
      <Route path="/flows" nest>
         <Switch>
            <Route
               path="/flows/:flow/connections/:connection"
               component={({ params: { flow, connection } }) => {
                  const flowConfig = config.flows?.[flow];
                  const c = config.flows?.[flow]?.connections?.[connection];
                  const s =
                     schema.properties.flows.additionalProperties.properties.connections
                        .additionalProperties;

                  fillTasks(s, flowConfig, "source");
                  fillTasks(s, flowConfig, "target");

                  return (
                     <Setting
                        schema={s}
                        config={c}
                        path={["flows", "flows", flow, "connections", connection]}
                        prefix={`${prefix}/flows/flows/${flow}/connections/${connection}`}
                     />
                  );
               }}
               nest
            />

            <Route
               path="/flows/:flow/tasks/:task"
               component={({ params: { flow, task } }) => {
                  const c = config.flows?.[flow]?.tasks?.[task];
                  const s =
                     schema.properties.flows.additionalProperties.properties.tasks
                        .additionalProperties;
                  const editSchema = s.anyOf.find((x) => x.properties.type.const === c?.type);

                  return (
                     <Setting
                        schema={editSchema}
                        config={c}
                        path={["flows", "flows", flow, "tasks", task]}
                        prefix={`${prefix}/flows/flows/${flow}/tasks/${task}`}
                        uiSchema={{
                           params: {
                              render: {
                                 "ui:field": "HtmlField",
                              },
                           },
                        }}
                     />
                  );
               }}
               nest
            />

            <Route
               path="/flows/:flow"
               component={({ params: { flow } }) => {
                  const c = config.flows?.[flow];
                  const flowSchema = schema.properties.flows.additionalProperties;
                  const newTask = flowSchema.properties.tasks.additionalProperties;
                  const newConnection = flowSchema.properties.connections.additionalProperties;

                  fillTasks(flowSchema, c, "start_task");
                  fillTasks(flowSchema, c, "responding_task");
                  fillTasks(newConnection, c, "source");
                  fillTasks(newConnection, c, "target");

                  return (
                     <Setting
                        schema={flowSchema}
                        config={c}
                        path={["flows", "flows", flow]}
                        prefix={`${prefix}/flows/flows/${flow}`}
                        properties={{
                           tasks: {
                              extract: true,
                              new: {
                                 schema: newTask,
                              },
                              tableValues: (config: any) =>
                                 transform(
                                    config,
                                    (acc, value, key) => {
                                       acc.push({
                                          name: key,
                                          type: value.type,
                                       });
                                    },
                                    [] as any[],
                                 ),
                           },
                           connections: {
                              extract: true,
                              new: {
                                 schema: newConnection,
                                 generateKey: crypto.randomUUID() as string,
                              },
                              tableValues: (config: any) =>
                                 transform(
                                    config,
                                    (acc, value, key) => {
                                       acc.push({
                                          id: key,
                                          source: value.source,
                                          target: value.target,
                                          condition: value.config.condition?.type,
                                       });
                                    },
                                    [] as any[],
                                 ),
                           },
                        }}
                     />
                  );
               }}
               nest
            />

            <Route
               path="/"
               component={() => (
                  <Setting
                     schema={schema}
                     uiSchema={uiSchema}
                     config={config}
                     properties={{
                        flows: {
                           extract: true,
                           new: {
                              schema: schema.properties.flows.additionalProperties as any,

                              /*uiSchema: {
                                 fields: {
                                    "ui:widget": "hidden"
                                 }
                              }*/
                           },
                           tableValues: (config: any) =>
                              transform(
                                 config,
                                 (acc, value, key) => {
                                    acc.push({
                                       name: key,
                                       trigger: value.trigger.type,
                                       mode: value.trigger.config.mode,
                                       start_task: value.start_task,
                                       responding_task: value.responding_task,
                                    });
                                 },
                                 [] as any[],
                              ),
                        },
                     }}
                     prefix={`${prefix}/flows`}
                     path={["flows"]}
                  />
               )}
               nest
            />
         </Switch>
      </Route>
   );
};
