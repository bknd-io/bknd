import { Check } from "@sinclair/typebox/value";
import { Errors } from "@sinclair/typebox/errors";
import { FromSchema } from "./from-schema";

import type {
   CustomValidator,
   ErrorTransformer,
   RJSFSchema,
   RJSFValidationError,
   StrictRJSFSchema,
   UiSchema,
   ValidationData,
   ValidatorType,
} from "@rjsf/utils";
import { toErrorSchema } from "@rjsf/utils";

const validate = true;

export class RJSFTypeboxValidator<T = any, S extends StrictRJSFSchema = RJSFSchema>
   implements ValidatorType
{
   // @ts-ignore
   rawValidation(schema: S, formData?: T) {
      if (!validate) {
         return { errors: [], validationError: null as any };
      }
      const tbSchema = FromSchema(schema as unknown);

      //console.log("--validation", tbSchema, formData);

      if (Check(tbSchema, formData)) {
         return { errors: [], validationError: null as any };
      }

      return {
         errors: [...Errors(tbSchema, formData)],
         validationError: null as any,
      };
   }

   validateFormData(
      formData: T | undefined,
      schema: S,
      customValidate?: CustomValidator,
      transformErrors?: ErrorTransformer,
      uiSchema?: UiSchema,
   ): ValidationData<T> {
      const { errors } = this.rawValidation(schema, formData);

      const transformedErrors = errors.map((error) => {
         const schemaLocation = error.path.substring(1).split("/").join(".");

         return {
            name: "any",
            message: error.message,
            property: "." + schemaLocation,
            schemaPath: error.path,
            stack: error.message,
         };
      });

      return {
         errors: transformedErrors,
         errorSchema: toErrorSchema(transformedErrors),
      } as any;
   }

   isValid(schema: S, formData: T | undefined, rootSchema: S): boolean {
      const validation = this.rawValidation(schema, formData);

      return validation.errors.length === 0;
   }

   toErrorList(): RJSFValidationError[] {
      return [];
   }
}
