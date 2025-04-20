import { $console, isDebug, tbValidator as tb } from "core";
import { StringEnum } from "core/utils";
import * as tbbox from "@sinclair/typebox";
import {
   DataPermissions,
   type EntityData,
   type EntityManager,
   type MutatorResponse,
   type RepoQuery,
   type RepositoryResponse,
   querySchema,
} from "data";
import type { Handler } from "hono/types";
import type { ModuleBuildContext } from "modules";
import { Controller } from "modules/Controller";
import * as SystemPermissions from "modules/permissions";
import type { AppDataConfig } from "../data-schema";
const { Type } = tbbox;

export class DataController extends Controller {
   constructor(
      private readonly ctx: ModuleBuildContext,
      private readonly config: AppDataConfig,
   ) {
      super();
   }

   get em(): EntityManager<any> {
      return this.ctx.em;
   }

   get guard() {
      return this.ctx.guard;
   }

   repoResult<T extends RepositoryResponse<any> = RepositoryResponse>(
      res: T,
   ): Pick<T, "meta" | "data"> {
      let meta: Partial<RepositoryResponse["meta"]> = {};

      if ("meta" in res) {
         const { query, ...rest } = res.meta;
         meta = rest;
         if (isDebug()) meta.query = query;
      }

      const template = { data: res.data, meta };

      // @todo: this works but it breaks in FE (need to improve DataTable)
      // filter empty
      return Object.fromEntries(
         Object.entries(template).filter(([_, v]) => typeof v !== "undefined" && v !== null),
      ) as any;
   }

   mutatorResult(res: MutatorResponse | MutatorResponse<EntityData>) {
      const template = { data: res.data };

      // filter empty
      return Object.fromEntries(Object.entries(template).filter(([_, v]) => v !== undefined));
   }

   entityExists(entity: string) {
      try {
         return !!this.em.entity(entity);
      } catch (e) {
         return false;
      }
   }

   override getController() {
      const { permission, auth } = this.middlewares;
      const hono = this.create().use(auth(), permission(SystemPermissions.accessApi));

      // @todo: sample implementation how to augment handler with additional info
      function handler<HH extends Handler>(name: string, h: HH): any {
         const func = h;
         // @ts-ignore
         func.description = name;
         return func;
      }

      // info
      hono.get(
         "/",
         handler("data info", (c) => {
            // sample implementation
            return c.json(this.em.toJSON());
         }),
      );

      // sync endpoint
      hono.get("/sync", permission(DataPermissions.databaseSync), async (c) => {
         const force = c.req.query("force") === "1";
         const drop = c.req.query("drop") === "1";
         //console.log("force", force);
         const tables = await this.em.schema().introspect();
         //console.log("tables", tables);
         const changes = await this.em.schema().sync({
            force,
            drop,
         });
         return c.json({ tables: tables.map((t) => t.name), changes });
      });

      /**
       * Schema endpoints
       */
      // read entity schema
      hono.get("/schema.json", permission(DataPermissions.entityRead), async (c) => {
         const $id = `${this.config.basepath}/schema.json`;
         const schemas = Object.fromEntries(
            this.em.entities.map((e) => [
               e.name,
               {
                  $ref: `${this.config.basepath}/schemas/${e.name}`,
               },
            ]),
         );
         return c.json({
            $schema: "https://json-schema.org/draft/2020-12/schema",
            $id,
            properties: schemas,
         });
      });

      // read schema
      hono.get(
         "/schemas/:entity/:context?",
         permission(DataPermissions.entityRead),
         tb(
            "param",
            Type.Object({
               entity: Type.String(),
               context: Type.Optional(StringEnum(["create", "update"])),
            }),
         ),
         async (c) => {
            const { entity, context } = c.req.param();
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const _entity = this.em.entity(entity);
            const schema = _entity.toSchema({ context } as any);
            const url = new URL(c.req.url);
            const base = `${url.origin}${this.config.basepath}`;
            const $id = `${this.config.basepath}/schemas/${entity}`;
            return c.json({
               $schema: `${base}/schema.json`,
               $id,
               title: _entity.label,
               $comment: _entity.config.description,
               ...schema,
            });
         },
      );

      // entity endpoints
      hono.route("/entity", this.getEntityRoutes());

      /**
       * Info endpoints
       */
      hono.get("/info/:entity", async (c) => {
         const { entity } = c.req.param();
         if (!this.entityExists(entity)) {
            return this.notFound(c);
         }
         const _entity = this.em.entity(entity);
         const fields = _entity.fields.map((f) => f.name);
         const $rels = (r: any) =>
            r.map((r: any) => ({
               entity: r.other(_entity).entity.name,
               ref: r.other(_entity).reference,
            }));

         return c.json({
            name: _entity.name,
            fields,
            relations: {
               all: $rels(this.em.relations.relationsOf(_entity)),
               listable: $rels(this.em.relations.listableRelationsOf(_entity)),
               source: $rels(this.em.relations.sourceRelationsOf(_entity)),
               target: $rels(this.em.relations.targetRelationsOf(_entity)),
            },
         });
      });

      return hono.all("*", (c) => c.notFound());
   }

   private getEntityRoutes() {
      const { permission } = this.middlewares;
      const hono = this.create();

      const definedEntities = this.em.entities.map((e) => e.name);
      const tbNumber = Type.Transform(Type.String({ pattern: "^[1-9][0-9]{0,}$" }))
         .Decode(Number.parseInt)
         .Encode(String);

      /**
       * Function endpoints
       */
      // fn: count
      hono.post(
         "/:entity/fn/count",
         permission(DataPermissions.entityRead),
         tb("param", Type.Object({ entity: Type.String() })),
         async (c) => {
            const { entity } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }

            const where = (await c.req.json()) as any;
            const result = await this.em.repository(entity).count(where);
            return c.json({ entity, count: result.count });
         },
      );

      // fn: exists
      hono.post(
         "/:entity/fn/exists",
         permission(DataPermissions.entityRead),
         tb("param", Type.Object({ entity: Type.String() })),
         async (c) => {
            const { entity } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }

            const where = c.req.json() as any;
            const result = await this.em.repository(entity).exists(where);
            return c.json({ entity, exists: result.exists });
         },
      );

      /**
       * Read endpoints
       */
      // read many
      hono.get(
         "/:entity",
         permission(DataPermissions.entityRead),
         tb("param", Type.Object({ entity: Type.String() })),
         tb("query", querySchema),
         async (c) => {
            const { entity } = c.req.param();
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const options = c.req.valid("query") as RepoQuery;
            const result = await this.em.repository(entity).findMany(options);

            return c.json(this.repoResult(result), { status: result.data ? 200 : 404 });
         },
      );

      // read one
      hono.get(
         "/:entity/:id",
         permission(DataPermissions.entityRead),
         tb(
            "param",
            Type.Object({
               entity: Type.String(),
               id: tbNumber,
            }),
         ),
         tb("query", querySchema),
         async (c) => {
            const { entity, id } = c.req.param();
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const options = c.req.valid("query") as RepoQuery;
            const result = await this.em.repository(entity).findId(Number(id), options);

            return c.json(this.repoResult(result), { status: result.data ? 200 : 404 });
         },
      );

      // read many by reference
      hono.get(
         "/:entity/:id/:reference",
         permission(DataPermissions.entityRead),
         tb(
            "param",
            Type.Object({
               entity: Type.String(),
               id: tbNumber,
               reference: Type.String(),
            }),
         ),
         tb("query", querySchema),
         async (c) => {
            const { entity, id, reference } = c.req.param();
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }

            const options = c.req.valid("query") as RepoQuery;
            const result = await this.em
               .repository(entity)
               .findManyByReference(Number(id), reference, options);

            return c.json(this.repoResult(result), { status: result.data ? 200 : 404 });
         },
      );

      // func query
      hono.post(
         "/:entity/query",
         permission(DataPermissions.entityRead),
         tb("param", Type.Object({ entity: Type.String() })),
         tb("json", querySchema),
         async (c) => {
            const { entity } = c.req.param();
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const options = (await c.req.valid("json")) as RepoQuery;
            const result = await this.em.repository(entity).findMany(options);

            return c.json(this.repoResult(result), { status: result.data ? 200 : 404 });
         },
      );

      /**
       * Mutation endpoints
       */
      // insert one
      hono.post(
         "/:entity",
         permission(DataPermissions.entityCreate),
         tb("param", Type.Object({ entity: Type.String() })),
         tb("json", Type.Union([Type.Object({}), Type.Array(Type.Object({}))])),
         async (c) => {
            const { entity } = c.req.param();
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const body = (await c.req.json()) as EntityData | EntityData[];

            if (Array.isArray(body)) {
               const result = await this.em.mutator(entity).insertMany(body);
               return c.json(this.mutatorResult(result), 201);
            }

            const result = await this.em.mutator(entity).insertOne(body);
            return c.json(this.mutatorResult(result), 201);
         },
      );

      // update many
      hono.patch(
         "/:entity",
         permission(DataPermissions.entityUpdate),
         tb("param", Type.Object({ entity: Type.String() })),
         tb(
            "json",
            Type.Object({
               update: Type.Object({}),
               where: querySchema.properties.where,
            }),
         ),
         async (c) => {
            const { entity } = c.req.param();
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const { update, where } = (await c.req.json()) as {
               update: EntityData;
               where: RepoQuery["where"];
            };
            const result = await this.em.mutator(entity).updateWhere(update, where);

            return c.json(this.mutatorResult(result));
         },
      );

      // update one
      hono.patch(
         "/:entity/:id",
         permission(DataPermissions.entityUpdate),
         tb("param", Type.Object({ entity: Type.String(), id: tbNumber })),
         async (c) => {
            const { entity, id } = c.req.param();
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const body = (await c.req.json()) as EntityData;
            const result = await this.em.mutator(entity).updateOne(Number(id), body);

            return c.json(this.mutatorResult(result));
         },
      );

      // delete one
      hono.delete(
         "/:entity/:id",
         permission(DataPermissions.entityDelete),
         tb("param", Type.Object({ entity: Type.String(), id: tbNumber })),
         async (c) => {
            const { entity, id } = c.req.param();
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const result = await this.em.mutator(entity).deleteOne(Number(id));

            return c.json(this.mutatorResult(result));
         },
      );

      // delete many
      hono.delete(
         "/:entity",
         permission(DataPermissions.entityDelete),
         tb("param", Type.Object({ entity: Type.String() })),
         tb("json", querySchema.properties.where),
         async (c) => {
            const { entity } = c.req.param();
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const where = c.req.valid("json") as RepoQuery["where"];
            const result = await this.em.mutator(entity).deleteWhere(where);

            return c.json(this.mutatorResult(result));
         },
      );

      return hono;
   }
}
