import { transformObject } from "core/utils";
import { cloneDeep, pick } from "lodash-es";
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
   roles: {
      "ui:options": {
         orderable: false,
      },
      permissions: {
         items: {
            "ui:widget": "checkboxes",
         },
         "ui:widget": "checkboxes",
      },
   },
};

export const AuthSettings = ({ schema: _unsafe_copy, config }) => {
   const _s = useBknd();
   const _schema = cloneDeep(_unsafe_copy);
   const prefix = _s.app.getAbsolutePath("settings");

   try {
      const user_entity = config.entity_name ?? "users";
      const entities = _s.config.data.entities ?? {};
      console.log("entities", entities, user_entity);
      const user_fields = Object.entries(entities[user_entity]?.fields ?? {})
         .map(([name, field]) => (!field.config?.virtual ? name : undefined))
         .filter(Boolean);

      if (user_fields.length > 0) {
         console.log("user_fields", user_fields);
         _schema.properties.jwt.properties.fields.items.enum = user_fields;
         _schema.properties.jwt.properties.fields.uniqueItems = true;
         uiSchema.jwt.fields["ui:widget"] = "checkboxes";
      }
   } catch (e) {}
   console.log("_s", _s);
   const roleSchema = _schema.properties.roles?.additionalProperties ?? { type: "object" };
   /* if (_s.permissions) {
      roleSchema.properties.permissions.items.enum = _s.permissions;
      roleSchema.properties.permissions.uniqueItems = true;
   } */

   return (
      <Route path="/auth" nest>
         <Switch>
            <Route
               path="/roles/:role"
               component={({ params: { role } }) => {
                  return (
                     <Setting
                        schema={roleSchema}
                        uiSchema={uiSchema.roles}
                        config={config.roles?.[role] as any}
                        path={["auth", "roles", role]}
                        prefix={`${prefix}/auth/roles/${role}`}
                     />
                  );
               }}
               nest
            />

            <Route
               path="/strategies/:strategy"
               component={({ params: { strategy } }) => {
                  const c = config.strategies?.[strategy];
                  // @ts-ignore
                  const s = _schema.properties.strategies.additionalProperties as any;
                  const editSchema = s.anyOf.find((x) => x.properties.type.const === c?.type);

                  return (
                     <Setting
                        schema={editSchema ?? s}
                        config={config.strategies?.[strategy] as any}
                        path={["auth", "strategies", strategy]}
                        prefix={`${prefix}/auth/strategies/${strategy}`}
                     />
                  );
               }}
               nest
            />

            <Route
               path="/"
               component={() => (
                  <Setting
                     schema={_schema}
                     uiSchema={uiSchema}
                     config={config}
                     options={{
                        showAlert: (config: any) => {
                           if (!config.enabled) {
                              return "Auth is disabled. Enable it by toggling the switch below. Please also make sure set a secure secret to sign JWT tokens.";
                           }
                           return;
                        },
                        reloadOnSave: true,
                     }}
                     properties={{
                        strategies: {
                           extract: true,
                           tableValues: (strategies: any) => {
                              return Object.values(
                                 transformObject(strategies, (s, name) => ({
                                    key: name,
                                    type: s.type,
                                 })),
                              );
                           },
                           new: {
                              schema: _schema.properties.strategies.additionalProperties,
                              uiSchema: uiSchema.strategies,
                              generateKey: (data) => {
                                 return data.type === "password"
                                    ? "password"
                                    : data.config.name?.toLowerCase() || "";
                              },
                           },
                        },
                        roles: {
                           extract: true,
                           new: {
                              schema: roleSchema,
                              uiSchema: uiSchema.roles,
                           },
                        },
                     }}
                     prefix={`${prefix}/auth`}
                     path={["auth"]}
                  />
               )}
               nest
            />
         </Switch>
      </Route>
   );
};
