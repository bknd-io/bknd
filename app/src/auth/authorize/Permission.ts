import { s, type ParseOptions, parse, InvalidSchemaError, HttpStatus } from "bknd/utils";

export const permissionOptionsSchema = s
   .strictObject({
      description: s.string(),
      filterable: s.boolean(),
   })
   .partial();

export type PermissionOptions = s.Static<typeof permissionOptionsSchema>;
export type PermissionContext<P extends Permission<any, any, any, any>> = P extends Permission<
   any,
   any,
   infer Context,
   any
>
   ? Context extends s.ObjectSchema
      ? s.Static<Context>
      : never
   : never;

export class InvalidPermissionContextError extends InvalidSchemaError {
   override name = "InvalidPermissionContextError";

   // changing to internal server error because it's an unexpected behavior
   override code = HttpStatus.INTERNAL_SERVER_ERROR;

   static from(e: InvalidSchemaError) {
      return new InvalidPermissionContextError(e.schema, e.value, e.errors);
   }
}

export class Permission<
   Name extends string = string,
   Options extends PermissionOptions = {},
   Context extends s.ObjectSchema | undefined = undefined,
   ContextValue = Context extends s.ObjectSchema ? s.Static<Context> : undefined,
> {
   constructor(
      public name: Name,
      public options: Options = {} as Options,
      public context: Context = undefined as Context,
   ) {}

   isFilterable() {
      return this.options.filterable === true;
   }

   parseContext(ctx: ContextValue, opts?: ParseOptions) {
      try {
         return this.context ? parse(this.context!, ctx, opts) : undefined;
      } catch (e) {
         if (e instanceof InvalidSchemaError) {
            throw InvalidPermissionContextError.from(e);
         }

         throw e;
      }
   }

   toJSON() {
      return {
         name: this.name,
         ...this.options,
         context: this.context,
      };
   }
}
