import {
   s,
   type ParseOptions,
   parse,
   InvalidSchemaError,
   recursivelyReplacePlaceholders,
} from "bknd/utils";
import * as query from "core/object/query/object-query";

export const permissionOptionsSchema = s
   .strictObject({
      description: s.string(),
      filterable: s.boolean(),
   })
   .partial();

export type PermissionOptions = s.Static<typeof permissionOptionsSchema>;

export class InvalidPermissionContextError extends InvalidSchemaError {
   override name = "InvalidPermissionContextError";

   static from(e: InvalidSchemaError) {
      return new InvalidPermissionContextError(e.schema, e.value, e.errors);
   }
}

export class Permission<
   Name extends string = string,
   Options extends PermissionOptions = {},
   Context extends s.ObjectSchema = s.ObjectSchema,
> {
   constructor(
      public name: Name,
      public options: Options = {} as Options,
      public context: Context = s.object({}) as Context,
   ) {}

   parseContext(ctx: s.Static<Context>, opts?: ParseOptions) {
      try {
         return parse(this.context, ctx, opts);
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

export const policySchema = s
   .strictObject({
      description: s.string(),
      condition: s.object({}, { default: {} }) as s.Schema<{}, query.ObjectQuery>,
      effect: s.string({ enum: ["allow", "deny", "filter"], default: "deny" }),
      filter: s.object({}, { default: {} }) as s.Schema<{}, query.ObjectQuery>,
   })
   .partial();
export type PolicySchema = s.Static<typeof policySchema>;

export class Policy<Schema extends PolicySchema> {
   public content: Schema;

   constructor(content?: Schema) {
      this.content = parse(policySchema, content ?? {}) as Schema;
   }

   replace(context: object, vars?: Record<string, any>) {
      return vars ? recursivelyReplacePlaceholders(context, /^@([a-zA-Z_\.]+)$/, vars) : context;
   }

   meetsCondition(context: object, vars?: Record<string, any>) {
      return query.validate(this.replace(this.content.condition!, vars), context);
   }

   meetsFilter(subject: object, vars?: Record<string, any>) {
      return query.validate(this.replace(this.content.filter!, vars), subject);
   }

   getFiltered<Given extends any[]>(given: Given): Given {
      return given.filter((item) => this.meetsFilter(item)) as Given;
   }

   toJSON() {
      return this.content;
   }
}
