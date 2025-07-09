import type { JSONSchema } from "json-schema-to-ts";
import { useBknd } from "ui/client/bknd";
import { Button } from "ui/components/buttons/Button";
import {
   AnyOf,
   AnyOfField,
   Field,
   Form,
   FormContextOverride,
   FormDebug,
   ObjectField,
   useFormError,
} from "ui/components/form/json-schema-form";
import { Scrollable } from "ui/layouts/AppShell/AppShell";

const schema2 = {
   type: "object",
   properties: {
      name: { type: "string", default: "Peter" },
      age: { type: "number" },
      gender: {
         type: "string",
         enum: ["male", "female", "uni"],
      },
      deep: {
         type: "object",
         properties: {
            nested: { type: "string" },
         },
      },
   },
   required: ["age"],
} as const satisfies JSONSchema;

const authSchema = {
   type: "object",
   properties: {
      what: {
         type: "array",
         items: {
            type: "string",
         },
      },
      jwt: {
         type: "object",
         properties: {
            fields: {
               type: "array",
               items: {
                  type: "string",
               },
            },
         },
      },
   },
} as const satisfies JSONSchema;

const formOptions = {
   debug: true,
};

export default function JsonSchemaForm3() {
   const { schema: _schema, config } = useBknd();
   const schema = JSON.parse(JSON.stringify(_schema));

   config.media.storage.body_max_size = 1;
   schema.media.properties.storage.properties.body_max_size.minimum = 0;
   schema.media.if = { properties: { enabled: { const: true } } };
   // biome-ignore lint/suspicious/noThenProperty: <explanation>
   schema.media.then = { required: ["adapter"] };
   //schema.media.properties.adapter.anyOf[2].properties.config.properties.path.minLength = 1;

   return (
      <Scrollable>
         <div className="flex flex-col p-3">
            <Form schema={_schema.auth.toJSON()} options={formOptions} />

            {/*<Form
               onChange={(data) => console.log("change", data)}
               onSubmit={(data) => console.log("submit", data)}
               schema={{
                  type: "object",
                  properties: {
                     name: { type: "string", default: "Peter", maxLength: 3 },
                     age: { type: "number" },
                     deep: {
                        type: "object",
                        properties: {
                           nested: { type: "string" }
                        }
                     }
                  },
                  required: ["age"],
                  additionalProperties: false
               }}
               initialValues={{ name: "Peter", age: 20, deep: { nested: "hello" } }}
               className="flex flex-col gap-3"
               validateOn="change"
               options={{ debug: true }}
            />*/}

            {/*<Form
               schema={{
                  type: "object",
                  properties: {
                     name: { type: "string", default: "Peter", minLength: 3 },
                     age: { type: "number" },
                     deep: {
                        anyOf: [
                           {
                              type: "object",
                              properties: {
                                 nested: { type: "string" }
                              }
                           },
                           {
                              type: "object",
                              properties: {
                                 nested2: { type: "string" }
                              }
                           }
                        ]
                     }
                  },
                  required: ["age"]
               }}
               className="flex flex-col gap-3"
               validateOn="change"
            >
               <Field name="" />
               <Subscribe2>
                  {(state) => (
                     <pre className="text-wrap whitespace-break-spaces  break-all">
                        {JSON.stringify(state, null, 2)}
                     </pre>
                  )}
               </Subscribe2>
            </Form>*/}

            {/*<Form
               schema={{
                  type: "object",
                  properties: {
                     name: { type: "string", default: "Peter", maxLength: 3 },
                     age: { type: "number" },
                     gender: {
                        type: "string",
                        enum: ["male", "female", "uni"]
                     },
                     deep: {
                        type: "object",
                        properties: {
                           nested: { type: "string" }
                        }
                     }
                  },
                  required: ["age"]
               }}
               className="flex flex-col gap-3"
               validateOn="change"
            >
               <div>random thing</div>
               <Field name="name" />
               <Field name="age" />
               <FormDebug />
               <FormDebug2 name="name" />
               <hr />
               <Subscribe2
               selector={(state) => ({ dirty: state.dirty, submitting: state.submitting })}
               >
                  {(state) => (
                     <pre className="text-wrap whitespace-break-spaces  break-all">
                        {JSON.stringify(state)}
                     </pre>
                  )}
               </Subscribe2>
            </Form>*/}

            {/*<Form
            schema={{
               type: "object",
               properties: {
                  bla: {
                     anyOf: [
                        {
                           type: "object",
                           properties: {
                              name: { type: "string" },
                              age: { type: "number" }
                           }
                        },
                        {
                           type: "object",
                           properties: {
                              start: { type: "string", enum: ["a", "b", "c"] },
                              end: { type: "number" }
                           }
                        }
                     ]
                  }
               }
            }}
         >
            <AutoForm />
         </Form>*/}

            {/*<Form
            schema={{
               type: "object",
               properties: {
                  title: {
                     type: "string"
                  },
                  tags: {
                     type: "array",
                     items: {
                        type: "string"
                     }
                  }
               }
            }}
            initialValues={{ tags: ["a", "b", "c"] }}
         >
            <AutoForm />
         </Form>*/}
            {/*<Form
               schema={{
                  type: "object",
                  properties: {
                     title: {
                        type: "string"
                     },
                     tags: {
                        type: "array",
                        items: {
                           type: "number"
                        }
                     },
                     method: {
                        type: "array",
                        uniqueItems: true,
                        items: {
                           type: "string",
                           enum: ["GET", "POST", "PUT", "DELETE"]
                        }
                     }
                  }
               }}
               initialValues={{ tags: [0, 1], method: ["GET"] }}
               options={{ debug: true }}
            >
               <Field name="" />
               <FormDebug />
            </Form>*/}

            {/*<Form
               schema={{
                  type: "object",
                  properties: {
                     title: {
                        type: "string"
                     },
                     tags: {
                        type: "array",
                        items: {
                           anyOf: [
                              { type: "string", title: "String" },
                              { type: "number", title: "Number" }
                           ]
                        }
                     }
                  }
               }}
               initialValues={{ tags: [0, 1] }}
            >
               <Field name="" />
               <FormDebug force />
            </Form>*/}

            {/*<CustomMediaForm />*/}

            {/*<Form
               schema={schema.media}
               initialValues={config.media as any}
               onSubmit={console.log}
               options={{ debug: true }}
            />*/}

            {/*<Form
               schema={removeKeyRecursively(schema.media, "pattern") as any}
               initialValues={config.media}
            >
               <AutoForm />
            </Form>*/}

            {/*<Form
               schema={removeKeyRecursively(schema.server, "pattern") as any}
               initialValues={config.server}
            >
               <AutoForm />
            </Form>*/}

            {/*<Form schema={ss} validateOn="change" />*/}
         </div>
      </Scrollable>
   );
}

const ss = {
   type: "object",
   properties: {
      name: { type: "string" },
      email: { type: "string", format: "email" },
      interested: { type: "boolean" },
      bla: {
         type: "string",
         enum: ["small", "medium", "large"],
      },
      password: { type: "string", format: "password" },
      birthdate: { type: "string", format: "date" },
      dinnerTime: { type: "string", format: "date-time" },
      age: { type: "number", minimum: 0, multipleOf: 5 },
      tags: {
         type: "array",
         items: {
            type: "string",
         },
      },
      config: {
         type: "object",
         properties: {
            min: { type: "number" },
         },
      },
   },
   required: ["name"],
   additionalProperties: false,
} as const satisfies JSONSchema;

function CustomMediaForm() {
   const { schema: _schema, config } = useBknd();
   const schema = JSON.parse(JSON.stringify(_schema));

   config.media.storage.body_max_size = 1;
   schema.media.properties.storage.properties.body_max_size.minimum = 0;
   schema.media.if = { properties: { enabled: { const: true } } };
   // biome-ignore lint/suspicious/noThenProperty: <explanation>
   schema.media.then = { required: ["adapter"] };

   return (
      <Form
         schema={schema.media}
         /*initialValues={config.media as any}*/
         className="flex flex-col gap-3"
         validateOn="change"
      >
         <Test />
         <Field name="enabled" />
         <Field name="basepath" />
         <Field name="entity_name" />
         <Field name="storage" />
         <AnyOf.Root path="adapter">
            <CustomMediaFormAdapter />
         </AnyOf.Root>
         <FormDebug force />
      </Form>
   );
}

const Test = () => {
   const errors = useFormError("", { strict: true });
   return <div>{errors.map((e) => e.message).join("\n")}</div>;
   //return <pre>{JSON.stringify(errors, null, 2)}</pre>;
};

function CustomMediaFormAdapter() {
   const ctx = AnyOf.useContext();

   return (
      <>
         <div className="flex flex-row gap-1">
            {ctx.schemas?.map((schema: any, i) => (
               <Button
                  key={i}
                  onClick={() => ctx.select(i)}
                  variant={ctx.selected === i ? "primary" : "default"}
               >
                  {schema.title ?? `Option ${i + 1}`}
               </Button>
            ))}
         </div>

         {ctx.selected !== null && (
            <FormContextOverride schema={ctx.selectedSchema} prefix={ctx.path}>
               <Field name="type" hidden />
               <ObjectField path="config" wrapperProps={{ label: false, wrapper: "group" }} />
            </FormContextOverride>
         )}
      </>
   );
}
