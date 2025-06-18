import { s } from "core/object/schema";
import { WhereBuilder, type WhereQuery } from "data/entities/query/WhereBuilder";
import { $console } from "core";
import { isObject } from "core/utils";
import type { CoercionOptions, TAnyOf } from "jsonv-ts";

// -------
// helpers
const stringIdentifier = s.string({
   // allow "id", "id,title" – but not "id," or "not allowed"
   pattern: "^(?:[a-zA-Z_$][\\w$]*)(?:,[a-zA-Z_$][\\w$]*)*$",
});
const stringArray = s.anyOf(
   [
      stringIdentifier,
      s.array(stringIdentifier, {
         uniqueItems: true,
      }),
   ],
   {
      default: [],
      coerce: (v): string[] => {
         if (Array.isArray(v)) {
            return v;
         } else if (typeof v === "string") {
            if (v.includes(",")) {
               return v.split(",");
            }
            return [v];
         }
         return [];
      },
   },
);

// -------
// sorting
const sortDefault = { by: "id", dir: "asc" };
const sortSchema = s.object({
   by: s.string(),
   dir: s.string({ enum: ["asc", "desc"] }).optional(),
});
type SortSchema = s.Static<typeof sortSchema>;
const sort = s.anyOf([s.string(), sortSchema], {
   default: sortDefault,
   coerce: (v): SortSchema => {
      if (typeof v === "string") {
         if (/^-?[a-zA-Z_][a-zA-Z0-9_.]*$/.test(v)) {
            const dir = v[0] === "-" ? "desc" : "asc";
            return { by: dir === "desc" ? v.slice(1) : v, dir } as any;
         } else if (/^{.*}$/.test(v)) {
            return JSON.parse(v) as any;
         }

         $console.warn(`Invalid sort given: '${JSON.stringify(v)}'`);
         return sortDefault as any;
      }
      return v as any;
   },
});

// ------
// filter
const where = s.anyOf([s.string(), s.object({})], {
   default: {},
   examples: [
      {
         attribute: {
            $eq: 1,
         },
      },
   ],
   coerce: (value: unknown) => {
      const q = typeof value === "string" ? JSON.parse(value) : value;
      return WhereBuilder.convert(q);
   },
});
//type WhereSchemaIn = s.Static<typeof where>;
//type WhereSchema = s.StaticCoerced<typeof where>;

// ------
// with
// @todo: waiting for recursion support
export type RepoWithSchema = Record<
   string,
   Omit<RepoQueryIn, "with"> & {
      with?: unknown;
   }
>;

const withSchema = <In, Out = In>(self: s.TSchema): s.TSchemaInOut<In, Out> =>
   s.anyOf([stringIdentifier, s.array(stringIdentifier), self], {
      coerce: function (this: TAnyOf<any>, _value: unknown, opts: CoercionOptions = {}) {
         let value: any = _value;

         if (typeof value === "string") {
            // if stringified object
            if (value.match(/^\{/) || value.match(/^\[/)) {
               value = JSON.parse(value);
            } else if (value.includes(",")) {
               value = value.split(",");
            } else {
               value = [value];
            }
         }

         // Convert arrays to objects
         if (Array.isArray(value)) {
            value = value.reduce((acc, v) => {
               acc[v] = {};
               return acc;
            }, {} as any);
         }

         // Handle object case
         if (isObject(value)) {
            for (const k in value) {
               value[k] = self.coerce(value[k], opts);
            }
         }

         return value as unknown as any;
      },
   }) as any;

// ==========
// REPO QUERY
export const repoQuery = s.recursive((self) =>
   s.partialObject({
      limit: s.number({ default: 10 }),
      offset: s.number({ default: 0 }),
      sort,
      where,
      select: stringArray,
      join: stringArray,
      with: withSchema<RepoWithSchema>(self),
   }),
);
export const getRepoQueryTemplate = () =>
   repoQuery.template({
      withOptional: true,
   }) as Required<RepoQuery>;

export type RepoQueryIn = {
   limit?: number;
   offset?: number;
   sort?: string | { by: string; dir: "asc" | "desc" };
   select?: string[];
   with?: string | string[] | Record<string, RepoQueryIn>;
   join?: string[];
   where?: WhereQuery;
};
export type RepoQuery = s.StaticCoerced<typeof repoQuery>;
