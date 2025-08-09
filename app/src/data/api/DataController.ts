import type { Handler } from "hono/types";
import type { ModuleBuildContext } from "modules";
import { Controller } from "modules/Controller";
import { jsc, s, describeRoute, schemaToSpec, omitKeys, pickKeys, mcpTool } from "bknd/utils";
import * as SystemPermissions from "modules/permissions";
import type { AppDataConfig } from "../data-schema";
import type { EntityManager, EntityData } from "data/entities";
import * as DataPermissions from "data/permissions";
import { repoQuery, type RepoQuery } from "data/server/query";

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
      const entitiesEnum = this.getEntitiesEnum(this.em);

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
         describeRoute({
            summary: "Retrieve data configuration",
            tags: ["data"],
         }),
         handler("data info", (c) => {
            // sample implementation
            return c.json(this.em.toJSON());
         }),
      );

      // sync endpoint
      hono.get(
         "/sync",
         permission(DataPermissions.databaseSync),
         mcpTool("data_sync"),
         describeRoute({
            summary: "Sync database schema",
            tags: ["data"],
         }),
         jsc(
            "query",
            s
               .object({
                  force: s.boolean(),
                  drop: s.boolean(),
               })
               .partial(),
         ),
         async (c) => {
            const { force, drop } = c.req.valid("query");
            const tables = await this.em.schema().introspect();
            const changes = await this.em.schema().sync({
               force,
               drop,
            });
            return c.json({ tables: tables.map((t) => t.name), changes });
         },
      );

      /**
       * Schema endpoints
       */
      // read entity schema
      hono.get(
         "/schema.json",
         permission(DataPermissions.entityRead),
         describeRoute({
            summary: "Retrieve data schema",
            tags: ["data"],
         }),
         async (c) => {
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
         },
      );

      // read schema
      hono.get(
         "/schemas/:entity/:context?",
         permission(DataPermissions.entityRead),
         describeRoute({
            summary: "Retrieve entity schema",
            tags: ["data"],
         }),
         jsc(
            "param",
            s.object({
               entity: entitiesEnum,
               context: s.string({ enum: ["create", "update"], default: "create" }).optional(),
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
      hono.get(
         "/info/:entity",
         permission(DataPermissions.entityRead),
         describeRoute({
            summary: "Retrieve entity info",
            tags: ["data"],
         }),
         mcpTool("data_entity_info"),
         jsc("param", s.object({ entity: entitiesEnum })),
         async (c) => {
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
         },
      );

      return hono;
   }

   private getEntityRoutes() {
      const { permission } = this.middlewares;
      const hono = this.create();

      const entitiesEnum = this.getEntitiesEnum(this.em);
      // @todo: make dynamic based on entity
      const idType = s.anyOf([s.number(), s.string()], { coerce: (v) => v as number | string });

      /**
       * Function endpoints
       */
      // fn: count
      hono.post(
         "/:entity/fn/count",
         permission(DataPermissions.entityRead),
         describeRoute({
            summary: "Count entities",
            tags: ["data"],
         }),
         mcpTool("data_entity_fn_count"),
         jsc("param", s.object({ entity: entitiesEnum })),
         jsc("json", repoQuery.properties.where),
         async (c) => {
            const { entity } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }

            const where = c.req.valid("json") as any;
            const result = await this.em.repository(entity).count(where);
            return c.json({ entity, ...result.data });
         },
      );

      // fn: exists
      hono.post(
         "/:entity/fn/exists",
         permission(DataPermissions.entityRead),
         describeRoute({
            summary: "Check if entity exists",
            tags: ["data"],
         }),
         mcpTool("data_entity_fn_exists"),
         jsc("param", s.object({ entity: entitiesEnum })),
         jsc("json", repoQuery.properties.where),
         async (c) => {
            const { entity } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }

            const where = c.req.valid("json") as any;
            const result = await this.em.repository(entity).exists(where);
            return c.json({ entity, ...result.data });
         },
      );

      /**
       * Read endpoints
       */
      // read many
      const saveRepoQuery = s
         .object({
            ...omitKeys(repoQuery.properties, ["with"]),
            sort: s.string({ default: "id" }),
            select: s.array(s.string()),
            join: s.array(s.string()),
         })
         .partial();
      const saveRepoQueryParams = (pick: string[] = Object.keys(repoQuery.properties)) => [
         ...(schemaToSpec(saveRepoQuery, "query").parameters?.filter(
            // @ts-ignore
            (p) => pick.includes(p.name),
         ) as any),
      ];
      const saveRepoQuerySchema = (pick: string[] = Object.keys(saveRepoQuery.properties)) => {
         return s.object(pickKeys(saveRepoQuery.properties, pick as any));
      };

      hono.get(
         "/:entity",
         describeRoute({
            summary: "Read many",
            parameters: saveRepoQueryParams(["limit", "offset", "sort", "select", "join"]),
            tags: ["data"],
         }),
         permission(DataPermissions.entityRead),
         jsc("param", s.object({ entity: entitiesEnum })),
         jsc("query", repoQuery, { skipOpenAPI: true }),
         async (c) => {
            const { entity } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const options = c.req.valid("query") as RepoQuery;
            const result = await this.em.repository(entity).findMany(options);

            return c.json(result, { status: result.data ? 200 : 404 });
         },
      );

      // read one
      hono.get(
         "/:entity/:id",
         describeRoute({
            summary: "Read one",
            parameters: saveRepoQueryParams(["offset", "sort", "select"]),
            tags: ["data"],
         }),
         permission(DataPermissions.entityRead),
         mcpTool("data_entity_read_one", {
            inputSchema: {
               param: s.object({ entity: entitiesEnum, id: idType }),
               query: saveRepoQuerySchema(["offset", "sort", "select"]),
            },
         }),
         jsc(
            "param",
            s.object({
               entity: entitiesEnum,
               id: idType,
            }),
         ),
         jsc("query", repoQuery, { skipOpenAPI: true }),
         async (c) => {
            const { entity, id } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const options = c.req.valid("query") as RepoQuery;
            const result = await this.em.repository(entity).findId(id, options);

            return c.json(result, { status: result.data ? 200 : 404 });
         },
      );

      // read many by reference
      hono.get(
         "/:entity/:id/:reference",
         describeRoute({
            summary: "Read many by reference",
            parameters: saveRepoQueryParams(),
            tags: ["data"],
         }),
         permission(DataPermissions.entityRead),
         jsc(
            "param",
            s.object({
               entity: entitiesEnum,
               id: idType,
               reference: s.string(),
            }),
         ),
         jsc("query", repoQuery, { skipOpenAPI: true }),
         async (c) => {
            const { entity, id, reference } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }

            const options = c.req.valid("query") as RepoQuery;
            const result = await this.em
               .repository(entity)
               .findManyByReference(id, reference, options);

            return c.json(result, { status: result.data ? 200 : 404 });
         },
      );

      // func query
      const fnQuery = s
         .object({
            ...saveRepoQuery.properties,
            with: s.object({}),
         })
         .partial();
      hono.post(
         "/:entity/query",
         describeRoute({
            summary: "Query entities",
            requestBody: {
               content: {
                  "application/json": {
                     schema: fnQuery.toJSON(),
                     example: fnQuery.template({ withOptional: true }),
                  },
               },
            },
            tags: ["data"],
         }),
         permission(DataPermissions.entityRead),
         mcpTool("data_entity_read_many", {
            inputSchema: {
               param: s.object({ entity: entitiesEnum }),
               json: fnQuery,
            },
         }),
         jsc("param", s.object({ entity: entitiesEnum })),
         jsc("json", repoQuery, { skipOpenAPI: true }),
         async (c) => {
            const { entity } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const options = c.req.valid("json") as RepoQuery;
            const result = await this.em.repository(entity).findMany(options);

            return c.json(result, { status: result.data ? 200 : 404 });
         },
      );

      /**
       * Mutation endpoints
       */
      // insert one or many
      hono.post(
         "/:entity",
         describeRoute({
            summary: "Insert one or many",
            tags: ["data"],
         }),
         permission(DataPermissions.entityCreate),
         mcpTool("data_entity_insert"),
         jsc("param", s.object({ entity: entitiesEnum })),
         jsc("json", s.anyOf([s.object({}), s.array(s.object({}))])),
         async (c) => {
            const { entity } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const body = (await c.req.json()) as EntityData | EntityData[];

            if (Array.isArray(body)) {
               const result = await this.em.mutator(entity).insertMany(body);
               return c.json(result, 201);
            }

            const result = await this.em.mutator(entity).insertOne(body);
            return c.json(result, 201);
         },
      );

      // update many
      hono.patch(
         "/:entity",
         describeRoute({
            summary: "Update many",
            tags: ["data"],
         }),
         permission(DataPermissions.entityUpdate),
         mcpTool("data_entity_update_many"),
         jsc("param", s.object({ entity: entitiesEnum })),
         jsc(
            "json",
            s.object({
               update: s.object({}),
               where: repoQuery.properties.where,
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

            return c.json(result);
         },
      );

      // update one
      hono.patch(
         "/:entity/:id",
         describeRoute({
            summary: "Update one",
            tags: ["data"],
         }),
         permission(DataPermissions.entityUpdate),
         mcpTool("data_entity_update_one"),
         jsc("param", s.object({ entity: entitiesEnum, id: idType })),
         jsc("json", s.object({})),
         async (c) => {
            const { entity, id } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const body = (await c.req.json()) as EntityData;
            const result = await this.em.mutator(entity).updateOne(id, body);

            return c.json(result);
         },
      );

      // delete one
      hono.delete(
         "/:entity/:id",
         describeRoute({
            summary: "Delete one",
            tags: ["data"],
         }),
         permission(DataPermissions.entityDelete),
         mcpTool("data_entity_delete_one"),
         jsc("param", s.object({ entity: entitiesEnum, id: idType })),
         async (c) => {
            const { entity, id } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const result = await this.em.mutator(entity).deleteOne(id);

            return c.json(result);
         },
      );

      // delete many
      hono.delete(
         "/:entity",
         describeRoute({
            summary: "Delete many",
            tags: ["data"],
         }),
         permission(DataPermissions.entityDelete),
         mcpTool("data_entity_delete_many"),
         jsc("param", s.object({ entity: entitiesEnum })),
         jsc("json", repoQuery.properties.where),
         async (c) => {
            const { entity } = c.req.valid("param");
            if (!this.entityExists(entity)) {
               return this.notFound(c);
            }
            const where = (await c.req.json()) as RepoQuery["where"];
            const result = await this.em.mutator(entity).deleteWhere(where);

            return c.json(result);
         },
      );

      return hono;
   }

   override registerMcp() {
      this.ctx.mcp
         .resource(
            "data_entities",
            "bknd://data/entities",
            (c) => c.json(c.context.ctx().em.toJSON().entities),
            {
               title: "Entities",
               description: "Retrieve all entities",
            },
         )
         .resource(
            "data_relations",
            "bknd://data/relations",
            (c) => c.json(c.context.ctx().em.toJSON().relations),
            {
               title: "Relations",
               description: "Retrieve all relations",
            },
         )
         .resource(
            "data_indices",
            "bknd://data/indices",
            (c) => c.json(c.context.ctx().em.toJSON().indices),
            {
               title: "Indices",
               description: "Retrieve all indices",
            },
         );
   }
}
