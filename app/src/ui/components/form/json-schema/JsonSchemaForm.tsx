import type { Schema } from "@cfworker/json-schema";
import Form from "@rjsf/core";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import { cloneDeep } from "lodash-es";
import { forwardRef, useId, useImperativeHandle, useRef, useState } from "react";
import { fields as Fields } from "./fields";
import { templates as Templates } from "./templates";
import { widgets as Widgets } from "./widgets";
import { JsonvTsValidator } from "./JsonvTsValidator";

const validator = new JsonvTsValidator();

// @todo: don't import FormProps, instead, copy it here instead of "any"
export type JsonSchemaFormProps = any & {
   schema: RJSFSchema | Schema;
   uiSchema?: any;
   direction?: "horizontal" | "vertical";
   onChange?: (value: any, isValid: () => boolean) => void;
   cleanOnChange?: boolean;
};

export type JsonSchemaFormRef = {
   formData: () => any;
   validateForm: () => boolean;
   silentValidate: () => boolean;
   cancel: () => void;
};

export const JsonSchemaForm = forwardRef<JsonSchemaFormRef, JsonSchemaFormProps>(
   (
      {
         className,
         direction = "vertical",
         schema,
         onChange,
         uiSchema,
         templates,
         fields,
         widgets,
         cleanOnChange,
         ...props
      },
      ref,
   ) => {
      const formRef = useRef<Form<any, RJSFSchema, any>>(null);
      const id = useId();
      const [value, setValue] = useState<any>(props.formData);

      const onSubmit = ({ formData }: any, e) => {
         e.preventDefault();
         console.log("Data submitted: ", formData);
         props.onSubmit?.(formData);
         return false;
      };
      const handleChange = ({ formData }: any, e) => {
         const clean = cleanOnChange !== false ? JSON.parse(JSON.stringify(formData)) : formData;
         console.log("Data changed: ", clean, { cleanOnChange });
         setValue(clean);
         onChange?.(clean, () => isValid(clean));
      };

      const isValid = (data: any) => validator.validateFormData(data, schema).errors.length === 0;

      useImperativeHandle(
         ref,
         () => ({
            formData: () => value,
            validateForm: () => formRef.current!.validateForm(),
            silentValidate: () => isValid(value),
            cancel: () => formRef.current!.reset(),
         }),
         [value],
      );

      const _uiSchema: UiSchema = {
         ...uiSchema,
         "ui:globalOptions": {
            ...uiSchema?.["ui:globalOptions"],
            enableMarkdownInDescription: true,
         },
         "ui:submitButtonOptions": {
            norender: true,
         },
      };
      const _fields: any = {
         ...Fields,
         ...fields,
      };
      const _templates: any = {
         ...Templates,
         ...templates,
      };
      const _widgets: any = {
         ...Widgets,
         ...widgets,
      };
      //console.log("schema", schema, removeTitleFromSchema(schema));

      return (
         <Form
            tagName="div"
            idSeparator="--"
            idPrefix={id}
            {...props}
            ref={formRef}
            className={["json-form", direction, className].join(" ")}
            showErrorList={false}
            schema={schema as RJSFSchema}
            fields={_fields}
            templates={_templates}
            widgets={_widgets}
            uiSchema={_uiSchema}
            onChange={handleChange}
            onSubmit={onSubmit}
            validator={validator as any}
         />
      );
   },
);
function removeTitleFromSchema(schema: any): any {
   // Create a deep copy of the schema using lodash
   const newSchema = cloneDeep(schema);

   function removeTitle(schema: any): void {
      if (typeof schema !== "object" || schema === null) return;

      // Remove title if present
      // biome-ignore lint/performance/noDelete: <explanation>
      delete schema.title;

      // Check nested schemas in anyOf, allOf, and oneOf
      const nestedKeywords = ["anyOf", "allOf", "oneOf"];
      nestedKeywords.forEach((keyword) => {
         if (Array.isArray(schema[keyword])) {
            schema[keyword].forEach((nestedSchema: any) => {
               removeTitle(nestedSchema);
            });
         }
      });

      // Recursively remove title from properties
      if (schema.properties && typeof schema.properties === "object") {
         Object.values(schema.properties).forEach((propertySchema: any) => {
            removeTitle(propertySchema);
         });
      }

      // Recursively remove title from items
      if (schema.items) {
         if (Array.isArray(schema.items)) {
            schema.items.forEach((itemSchema: any) => {
               removeTitle(itemSchema);
            });
         } else {
            removeTitle(schema.items);
         }
      }
   }

   removeTitle(newSchema);
   return newSchema;
}
