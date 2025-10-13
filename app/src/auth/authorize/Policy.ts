import { s, parse, recursivelyReplacePlaceholders } from "bknd/utils";
import * as query from "core/object/query/object-query";

export const policySchema = s
   .strictObject({
      description: s.string(),
      condition: s.object({}).optional() as s.Schema<{}, query.ObjectQuery | undefined>,
      // @todo: potentially remove this, and invert from rolePermission.effect
      effect: s.string({ enum: ["allow", "deny", "filter"], default: "allow" }),
      filter: s.object({}).optional() as s.Schema<{}, query.ObjectQuery | undefined>,
   })
   .partial();
export type PolicySchema = s.Static<typeof policySchema>;

export class Policy<Schema extends PolicySchema = PolicySchema> {
   public content: Schema;

   constructor(content?: Schema) {
      this.content = parse(policySchema, content ?? {}, {
         withDefaults: true,
      }) as Schema;
   }

   replace(context: object, vars?: Record<string, any>) {
      return vars ? recursivelyReplacePlaceholders(context, /^@([a-zA-Z_\.]+)$/, vars) : context;
   }

   meetsCondition(context: object, vars?: Record<string, any>) {
      if (!this.content.condition) return true;
      return query.validate(this.replace(this.content.condition!, vars), context);
   }

   meetsFilter(subject: object, vars?: Record<string, any>) {
      if (!this.content.filter) return true;
      return query.validate(this.replace(this.content.filter!, vars), subject);
   }

   getFiltered<Given extends any[]>(given: Given): Given {
      return given.filter((item) => this.meetsFilter(item)) as Given;
   }

   toJSON() {
      return this.content;
   }
}
