import * as s from "jsonv-ts";

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

export class JsonvTsValidator<T = any, S extends StrictRJSFSchema = RJSFSchema>
   implements ValidatorType
{
   // @ts-ignore
   rawValidation(schema: S, formData?: T) {
      if (!validate) {
         return { errors: [], validationError: null as any };
      }

      const jsSchema = s.fromSchema(JSON.parse(JSON.stringify(schema)) as any);
      const result = jsSchema.validate(formData);

      if (result.valid) {
         return { errors: [], validationError: null as any };
      }

      return {
         errors: result.errors,
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
         return {
            name: "any",
            message: error.error,
            property: "." + error.instanceLocation.substring(1).split("/").join("."),
            schemaPath: error.instanceLocation,
            stack: error.error,
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
