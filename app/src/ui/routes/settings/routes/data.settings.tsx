import { cloneDeep, transform } from "lodash-es";
import type { ModuleConfigs, ModuleSchemas } from "modules";
import { useBknd } from "ui/client/bknd";
import { fieldSpecs } from "ui/modules/data/components/fields-specs";
import { Route, Switch } from "wouter";
import { Setting } from "../components/Setting";

export const dataFieldsUiSchema = {
   config: {
      fillable: {
         "ui:options": {
            wrap: true,
         },
         anyOf: [
            {},
            {
               "ui:widget": "checkboxes",
            },
         ],
      },
      hidden: {
         "ui:options": {
            wrap: true,
         },
         anyOf: [
            {},
            {
               "ui:widget": "checkboxes",
            },
         ],
      },
      schema: {
         "ui:field": "JsonField",
      },
      ui_schema: {
         "ui:field": "JsonField",
      },
   },
};

const fieldsAnyOfValues = fieldSpecs
   .filter((s) => s.type !== "primary")
   .reduce((acc, s) => {
      acc[s.type] = {
         label: s.label,
         icon: s.icon,
      };
      return acc;
   }, {});

const relationAnyOfValues = {
   "1:1": {
      label: "One-to-One",
   },
   "n:1": {
      label: "Many-to-One",
   },
   "m:n": {
      label: "Many-to-Many",
   },
   poly: {
      label: "Polymorphic",
   },
};

export const DataSettings = ({
   schema,
   config,
}: { schema: ModuleSchemas["data"]; config: ModuleConfigs["data"] }) => {
   const { app, readonly } = useBknd();
   const prefix = app.getAbsolutePath("settings");
   const entities = Object.keys(config.entities ?? {});

   function fillEntities(schema: any, key: string = "entity") {
      if (entities.length === 0) return;
      if (schema.properties && key in schema.properties) {
         schema.properties[key].enum = entities;
      }
      if ("anyOf" in schema) {
         schema.anyOf.forEach((s) => fillEntities(s, key));
      }
   }

   return (
      <Route path="/data" nest>
         <Switch>
            <Route
               path="/entities/:entity/fields/:field"
               component={({ params: { entity, field } }) => {
                  const c = config.entities?.[entity]?.fields?.[field];
                  // @ts-ignore
                  const s = schema.properties.entities.additionalProperties?.properties?.fields
                     .additionalProperties as any;

                  const editSchema = s.anyOf.find((x) => x.properties.type.const === c?.type);
                  //console.log("editSchema", editSchema);

                  return (
                     <Setting
                        schema={editSchema ?? s}
                        // @ts-ignore
                        config={c}
                        prefix={`${prefix}/data/entities/${entity}/fields/${field}`}
                        path={["data", "entities", entity, "fields", field]}
                        options={{
                           showAlert: (config: any) => {
                              // it's weird, but after creation, the config is not set (?)
                              if (config?.type === "primary" && !readonly) {
                                 return "Modifying the primary field may result in strange behaviors.";
                              }
                              return;
                           },
                        }}
                        uiSchema={dataFieldsUiSchema}
                     />
                  );
               }}
               nest
            />

            <Route
               path="/entities/:entity"
               component={({ params: { entity } }) => {
                  const s = schema.properties.entities.additionalProperties as any;
                  const editSchema = cloneDeep(s);
                  editSchema.properties.type.readOnly = true;

                  const fieldsSchema = {
                     anyOf: editSchema.properties.fields.additionalProperties.anyOf.filter(
                        (s) => s.properties.type.const !== "primary",
                     ),
                  } as any;

                  return (
                     <Setting
                        schema={editSchema}
                        config={config.entities?.[entity] as any}
                        options={{
                           showAlert: (config: any) => {
                              if (config.type === "system" && !readonly) {
                                 return "Modifying the system entities may result in strange behaviors.";
                              }
                              return;
                           },
                        }}
                        properties={{
                           fields: {
                              extract: true,
                              tableValues: (config: any) =>
                                 transform(
                                    config,
                                    (acc, value, key) => {
                                       acc.push({
                                          property: key,
                                          type: value.type,
                                          required: value.config?.required ? "Yes" : "No",
                                       });
                                    },
                                    [] as any[],
                                 ),
                              new: {
                                 schema: fieldsSchema,
                                 uiSchema: dataFieldsUiSchema,
                                 anyOfValues: fieldsAnyOfValues,
                              },
                           },
                        }}
                        path={["data", "entities", entity]}
                        prefix={`${prefix}/data/entities/${entity}`}
                     />
                  );
               }}
               nest
            />

            {/* indices */}
            <Route
               path="/indices/:index"
               component={({ params: { index } }) => {
                  const indicesSchema = schema.properties.indices.additionalProperties as any;

                  if (entities.length > 0) {
                     fillEntities(indicesSchema, "entity");
                     //indicesSchema.properties.entity.enum = entities;
                  }

                  return (
                     <Setting
                        schema={schema.properties.indices.additionalProperties as any}
                        config={config.indices?.[index] as any}
                        path={["data", "indices", index]}
                        prefix={`${prefix}/data/indices/${index}`}
                     />
                  );
               }}
               nest
            />

            {/* relations */}
            <Route
               path="/relations/:relation"
               component={({ params: { relation } }) => {
                  const c = config.relations?.[relation];
                  // @ts-ignore
                  const s = schema.properties.relations.additionalProperties as any;
                  const editSchema = s.anyOf.find((x) => x.properties.type.const === c?.type);

                  if (entities.length > 0) {
                     fillEntities(editSchema, "source");
                     fillEntities(editSchema, "target");
                  }

                  return (
                     <Setting
                        schema={editSchema}
                        config={c}
                        path={["data", "relations", relation]}
                        prefix={`${prefix}/data/relations/${relation}`}
                     />
                  );
               }}
               nest
            />

            <Route
               path="/"
               component={() => {
                  const newIndex = schema.properties.indices.additionalProperties as any;
                  const newRelation = schema.properties.relations.additionalProperties as any;

                  fillEntities(newIndex, "entity");
                  fillEntities(newRelation, "source");
                  fillEntities(newRelation, "target");

                  return (
                     <Setting
                        schema={schema}
                        config={config}
                        properties={{
                           entities: {
                              extract: true,
                              tableValues: (config: any) =>
                                 transform(
                                    config,
                                    (acc, value, key) => {
                                       acc.push({
                                          name: key,
                                          type: value.type,
                                          fields: Object.keys(value.fields ?? {}).length,
                                       });
                                    },
                                    [] as any[],
                                 ),
                              new: {
                                 schema: schema.properties.entities.additionalProperties as any,
                                 uiSchema: {
                                    fields: {
                                       "ui:widget": "hidden",
                                    },
                                    type: {
                                       "ui:widget": "hidden",
                                    },
                                 },
                              },
                           },
                           relations: {
                              extract: true,
                              new: {
                                 schema: schema.properties.relations.additionalProperties as any,
                                 generateKey: (data: any) => {
                                    const parts = [
                                       data.type.replace(":", ""),
                                       data.source,
                                       data.target,
                                       data.config?.mappedBy,
                                       data.config?.inversedBy,
                                       data.config?.connectionTable,
                                       data.config?.connectionTableMappedName,
                                    ].filter(Boolean);

                                    return [...new Set(parts)].join("_");
                                 },
                                 anyOfValues: relationAnyOfValues,
                              },
                              tableValues: (config: any) =>
                                 transform(
                                    config,
                                    (acc, value, key) => {
                                       acc.push({
                                          name: key,
                                          type: value.type,
                                          source: value.source,
                                          target: value.target,
                                       });
                                    },
                                    [] as any[],
                                 ),
                           },
                           indices: {
                              extract: true,
                              tableValues: (config: any) =>
                                 transform(
                                    config,
                                    (acc, value, key) => {
                                       acc.push({
                                          name: key,
                                          entity: value.entity,
                                          fields: value.fields.join(", "),
                                          unique: value.unique ? "Yes" : "No",
                                       });
                                    },
                                    [] as any[],
                                 ),
                              new: {
                                 schema: newIndex,
                                 uiSchema: {
                                    fields: {
                                       "ui:options": {
                                          orderable: false,
                                       },
                                    },
                                 },
                                 generateKey: (data: any) => {
                                    const parts = [
                                       "idx",
                                       data.entity,
                                       data.unique && "unique",
                                       ...data.fields.filter(Boolean),
                                    ].filter(Boolean);

                                    return parts.join("_");
                                 },
                              },
                           },
                        }}
                        prefix={`${prefix}/data`}
                        path={["data"]}
                     />
                  );
               }}
               nest
            />
         </Switch>
      </Route>
   );
};
